package com.ikoko.gibookshelf

import android.graphics.Bitmap
import android.graphics.Color as AndroidColor
import android.graphics.pdf.PdfRenderer
import android.net.Uri
import android.os.Bundle
import android.os.ParcelFileDescriptor
import android.speech.tts.TextToSpeech
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.Image
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.ArrowBack
import androidx.compose.material.icons.filled.Book
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.PlayArrow
import androidx.compose.material.icons.filled.Stop
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.tom_roush.pdfbox.android.PDFBoxResourceLoader
import com.tom_roush.pdfbox.pdmodel.PDDocument
import com.tom_roush.pdfbox.text.PDFTextStripper
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.io.File
import java.util.Locale

private val Gold = Color(0xFFE3B75B)
private val Background = Color(0xFF100D09)
private val SurfaceGold = Color(0xFF21180D)
private val Muted = Color(0xFFB7A98F)

data class LocalBook(val uri: String, val name: String)

class MainActivity : ComponentActivity(), TextToSpeech.OnInitListener {
    private var tts: TextToSpeech? = null
    private var ttsReady = false
    private var ttsMessage by mutableStateOf("မြန်မာ TTS အခြေအနေ စစ်ဆေးနေသည်")
    private var currentBookName by mutableStateOf("")
    private var currentUri by mutableStateOf<Uri?>(null)
    private var pageCount by mutableIntStateOf(0)
    private var pageIndex by mutableIntStateOf(0)
    private var pageBitmap by mutableStateOf<Bitmap?>(null)
    private var extractedText by mutableStateOf("")
    private var errorMessage by mutableStateOf("")

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        PDFBoxResourceLoader.init(applicationContext)
        tts = TextToSpeech(this, this)
        setContent { BookshelfApp() }
    }

    override fun onInit(status: Int) {
        if (status == TextToSpeech.SUCCESS) {
            val result = tts?.setLanguage(Locale("my", "MM"))
            ttsReady = result != null && result != TextToSpeech.LANG_MISSING_DATA && result != TextToSpeech.LANG_NOT_SUPPORTED
            ttsMessage = if (ttsReady) "မြန်မာအသံဖတ်စနစ် အသင့်ဖြစ်ပါပြီ" else
                "ဖုန်းတွင် မြန်မာ TTS voice မရှိသေးပါ။ MyanmarTTS native engine မပေါင်းစည်းရသေးပါ။"
        } else ttsMessage = "Android TTS engine စတင်မရပါ"
    }

    private suspend fun openPdf(uri: Uri, displayName: String) {
        try {
            val result = withContext(Dispatchers.IO) {
                val file = File(cacheDir, "current-reader.pdf")
                contentResolver.openInputStream(uri)?.use { input -> file.outputStream().use { output -> input.copyTo(output) } }
                    ?: error("PDF ဖိုင်ကို ဖတ်မရပါ")
                val doc = PDDocument.load(file)
                val text = try { PDFTextStripper().getText(doc) } finally { doc.close() }
                val pfd = ParcelFileDescriptor.open(file, ParcelFileDescriptor.MODE_READ_ONLY)
                val renderer = PdfRenderer(pfd)
                val count = renderer.pageCount
                val bitmap = if (count > 0) render(renderer, 0) else null
                renderer.close(); pfd.close()
                Triple(count, bitmap, text)
            }
            currentUri = uri
            currentBookName = displayName
            pageCount = result.first
            pageIndex = 0
            pageBitmap = result.second
            extractedText = result.third
            errorMessage = if (result.third.isBlank()) "Selectable text မတွေ့ပါ။ Scanned PDF OCR မပါသေးပါ။" else ""
        } catch (e: Exception) { errorMessage = "PDF ဖွင့်မရပါ: ${e.message}" }
    }

    private fun render(renderer: PdfRenderer, index: Int): Bitmap {
        return renderer.openPage(index).use { page ->
            val width = 900
            val height = (width.toFloat() * page.height / page.width).toInt().coerceAtLeast(1)
            Bitmap.createBitmap(width, height, Bitmap.Config.ARGB_8888).also {
                it.eraseColor(AndroidColor.WHITE)
                page.render(it, null, null, PdfRenderer.Page.RENDER_MODE_FOR_DISPLAY)
            }
        }
    }

    @Composable
    private fun BookshelfApp() {
        val prefs = remember { getSharedPreferences("gi-library", MODE_PRIVATE) }
        val saved = remember { mutableStateListOf<LocalBook>().apply {
            prefs.getStringSet("books", emptySet()).orEmpty().forEach { entry ->
                val split = entry.split("|", limit = 2)
                if (split.size == 2) add(LocalBook(split[0], split[1]))
            }
        } }
        var showReader by remember { mutableStateOf(false) }
        val scope = rememberCoroutineScope()
        val picker = rememberLauncherForActivityResult(ActivityResultContracts.OpenDocument()) { uri ->
            if (uri != null) {
                try { contentResolver.takePersistableUriPermission(uri, android.content.Intent.FLAG_GRANT_READ_URI_PERMISSION) } catch (_: Exception) {}
                val name = uri.lastPathSegment?.substringAfterLast('/')?.substringBefore('?') ?: "PDF စာအုပ်"
                if (saved.none { it.uri == uri.toString() }) saved.add(LocalBook(uri.toString(), name))
                prefs.edit().putStringSet("books", saved.map { "${it.uri}|${it.name}" }.toSet()).apply()
                showReader = true
                scope.launch { openPdf(uri, name) }
            }
        }
        MaterialTheme(colorScheme = darkColorScheme(primary = Gold, onPrimary = Background, background = Background, surface = SurfaceGold, onSurface = Color(0xFFF7EBD3), secondary = Muted)) {
            Surface(Modifier.fillMaxSize(), color = Background) {
                if (showReader && currentUri != null) ReaderScreen() else Column(Modifier.fillMaxSize().padding(20.dp)) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Icon(Icons.Default.Book, null, tint = Gold, modifier = Modifier.size(30.dp))
                        Spacer(Modifier.width(10.dp))
                        Column {
                            Text("G.I BOOKSHELF", color = Gold, fontWeight = FontWeight.Bold, fontSize = 21.sp)
                            Text("OFFLINE MYANMAR PDF READER", color = Muted, fontSize = 10.sp, letterSpacing = 1.sp)
                        }
                    }
                    Spacer(Modifier.height(26.dp))
                    Text("သင့်စာအုပ်စင်", color = Color.White, fontSize = 24.sp, fontWeight = FontWeight.Bold)
                    Text("ဖုန်းထဲမှ PDF ကို ထည့်ပြီး အင်တာနက်မလိုဘဲ ဖတ်ရှုပါ", color = Muted, fontSize = 13.sp)
                    Spacer(Modifier.height(18.dp))
                    Button(onClick = { picker.launch(arrayOf("application/pdf")) }, colors = ButtonDefaults.buttonColors(containerColor = Gold, contentColor = Background), modifier = Modifier.fillMaxWidth()) {
                        Icon(Icons.Default.Add, null); Spacer(Modifier.width(8.dp)); Text("PDF စာအုပ်ထည့်ရန်")
                    }
                    Spacer(Modifier.height(20.dp))
                    Text(ttsMessage, color = if (ttsReady) Gold else Muted, fontSize = 12.sp)
                    Spacer(Modifier.height(14.dp))
                    if (saved.isEmpty()) Box(Modifier.fillMaxWidth().weight(1f), contentAlignment = Alignment.Center) {
                        Text("စာအုပ်မရှိသေးပါ။ PDF တစ်ခုထည့်ပြီး စတင်ဖတ်ရှုပါ။", color = Muted)
                    } else LazyColumn(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                        items(saved.toList()) { book ->
                            Card(colors = CardDefaults.cardColors(containerColor = SurfaceGold), shape = RoundedCornerShape(14.dp), modifier = Modifier.fillMaxWidth()) {
                                Row(Modifier.padding(14.dp), verticalAlignment = Alignment.CenterVertically) {
                                    Icon(Icons.Default.Book, null, tint = Gold); Spacer(Modifier.width(12.dp))
                                    Text(book.name, Modifier.weight(1f), color = Color.White)
                                    TextButton(onClick = { showReader = true; scope.launch { openPdf(Uri.parse(book.uri), book.name) } }) { Text("ဖတ်ရန်", color = Gold) }
                                    IconButton(onClick = {
                                        saved.remove(book)
                                        prefs.edit().putStringSet("books", saved.map { "${it.uri}|${it.name}" }.toSet()).apply()
                                    }) { Icon(Icons.Default.Delete, null, tint = Muted) }
                                }
                            }
                        }
                    }
                    Spacer(Modifier.height(10.dp))
                    Text("Powered by I KO KO", color = Muted, fontSize = 10.sp, modifier = Modifier.align(Alignment.CenterHorizontally))
                }
            }
        }
    }

    @Composable
    private fun ReaderScreen() {
        val scope = rememberCoroutineScope()
        Column(Modifier.fillMaxSize().padding(12.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                IconButton(onClick = { currentUri = null }) { Icon(Icons.Default.ArrowBack, null, tint = Gold) }
                Text(currentBookName, color = Color.White, fontWeight = FontWeight.SemiBold, modifier = Modifier.weight(1f), maxLines = 1)
            }
            if (errorMessage.isNotBlank()) Text(errorMessage, color = Gold, fontSize = 12.sp)
            pageBitmap?.let { Image(it.asImageBitmap(), null, Modifier.weight(1f).fillMaxWidth().padding(vertical = 8.dp)) }
                ?: Box(Modifier.weight(1f).fillMaxWidth(), contentAlignment = Alignment.Center) { CircularProgressIndicator(color = Gold) }
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                TextButton(onClick = { if (pageIndex > 0) scope.launch { renderCurrentPage(pageIndex - 1) } }, enabled = pageIndex > 0) { Text("ယခင်", color = Gold) }
                Text("${if (pageCount == 0) 0 else pageIndex + 1} / $pageCount", color = Muted)
                TextButton(onClick = { if (pageIndex + 1 < pageCount) scope.launch { renderCurrentPage(pageIndex + 1) } }, enabled = pageIndex + 1 < pageCount) { Text("နောက်", color = Gold) }
            }
            HorizontalDivider(color = Gold.copy(alpha = 0.25f))
            Text("စာသားဖတ်ရန်", color = Gold, fontWeight = FontWeight.Bold, modifier = Modifier.padding(top = 10.dp))
            Text(extractedText.take(900), color = Color(0xFFE8DDC9), fontSize = 12.sp, lineHeight = 19.sp, modifier = Modifier.heightIn(max = 110.dp))
            Row(verticalAlignment = Alignment.CenterVertically) {
                Button(onClick = {
                    val snippet = extractedText.take(3500)
                    if (ttsReady && snippet.isNotBlank()) tts?.speak(snippet, TextToSpeech.QUEUE_FLUSH, null, "gi-pdf-read")
                    else errorMessage = "မြန်မာ TTS voice မရနိုင်သေးပါ။ MyanmarTTS offline engine ကို နောက်အဆင့်တွင် ပေါင်းစည်းရန်လိုသည်။"
                }, colors = ButtonDefaults.buttonColors(containerColor = Gold, contentColor = Background), modifier = Modifier.weight(1f)) {
                    Icon(Icons.Default.PlayArrow, null); Spacer(Modifier.width(6.dp)); Text("အသံဖတ်")
                }
                IconButton(onClick = { tts?.stop() }) { Icon(Icons.Default.Stop, null, tint = Gold) }
            }
        }
    }

    private suspend fun renderCurrentPage(index: Int) {
        withContext(Dispatchers.IO) {
            val file = File(cacheDir, "current-reader.pdf")
            val pfd = ParcelFileDescriptor.open(file, ParcelFileDescriptor.MODE_READ_ONLY)
            val renderer = PdfRenderer(pfd)
            val bitmap = render(renderer, index)
            renderer.close(); pfd.close()
            withContext(Dispatchers.Main) { pageIndex = index; pageBitmap = bitmap }
        }
    }

    override fun onDestroy() {
        tts?.stop(); tts?.shutdown()
        super.onDestroy()
    }
}
