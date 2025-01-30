// npm install @google/generative-ai express @google/firebase-admin dotenv
const express = require('express');
const { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } = require("@google/generative-ai");
const dotenv = require('dotenv').config();
const admin = require('firebase-admin');
const path = require('path');
const fs = require('fs');
const cors = require("cors");
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));


// Initialize Firebase
const serviceAccount = require(path.join(__dirname, 'serviceAccountKey.json'));

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: 'https://ava-vitamin-default-rtdb.europe-west1.firebasedatabase.app'
});

const app = express();
const corsOptions = {
  origin: 'https://mai.mbaai.com.tr',  // Kendi domaininiz
  methods: ['GET', 'POST'], // İzin verilen HTTP yöntemleri
  credentials: true,
  optionsSuccessStatus: 200 // some legacy browsers (IE11, various SmartTVs) choke on 204
};

app.use(cors(corsOptions)); // CORS middleware'i kullanın

const port = process.env.PORT || 3000;
app.use(express.json());
const MODEL_NAME = "gemini-2.0-flash-exp";
const API_KEY = process.env.API_KEY;
const db = admin.database();
app.use(express.static(path.join(__dirname))); 

const urlPattern = /(\b(https?|ftp|file):\/\/[-A-Z0-9+&@#\/%?=~_|!:,.;]*[-A-Z0-9+&@#\/%=~_|])/ig;
const codeBlockPattern = /```(\w+)?\n([\s\S]*?)```/g;
const inlineCodePattern = /`([^`]+)`/g;
const boldPattern = /\*\*(.*?)\*\*/g;
const italicPattern = /(\*|_)(.*?)\1/g;
const strikethroughPattern = /~(.*?)~/g;
const headingPattern = /^(#{1,6})\s+(.*)$/gm;
const listPattern = /^(\*|-|\+)\s+(.*)$/gm;
const blockquotePattern = /^>\s+(.*)$/gm;

function validateMessageFormat(message) {
  // Mesajı Regex ifadeleriyle kontrol edin
  let isValid = true;
  let urls = [];

  if (message.match(urlPattern)) {
    console.log("Mesaj URL içeriyor.");
  } else if (message.match(codeBlockPattern)) {
    console.log("Mesaj kod bloğu içeriyor.");
  } else if (message.match(inlineCodePattern)) {
    console.log("Mesaj satır içi kod içeriyor.");
  } else if (message.match(boldPattern)) {
    console.log("Mesaj kalın metin içeriyor.");
  } else if (message.match(italicPattern)) {
    console.log("Mesaj italik metin içeriyor.");
  } else if (message.match(strikethroughPattern)) {
    console.log("Mesaj üstü çizili metin içeriyor.");
  } else if (message.match(headingPattern)) {
    console.log("Mesaj başlık içeriyor.");
  } else if (message.match(listPattern)) {
    console.log("Mesaj liste içeriyor.");
  } else if (message.match(blockquotePattern)) {
    console.log("Mesaj alıntı içeriyor.");
  } 

  if (isValid) {
    message = message
      .replace(urlPattern, '<a href="$1" target="_blank">$1</a>')
      .replace(inlineCodePattern, '<code>$1</code>')
      .replace(boldPattern, '<strong>$1</strong>')
      .replace(italicPattern, '<em>$2</em>')
      .replace(strikethroughPattern, '<del>$1</del>')
      .replace(headingPattern, (match, hashes, text) => `<h${hashes.length}>${text}</h${hashes.length}>`)
      .replace(listPattern, '<li>$2</li>')
      .replace(blockquotePattern, '<blockquote>$1</blockquote>')
      // Kod bloğu formatlamasını en son yapın
      .replace(codeBlockPattern, (match, language, code) => {
        // HTML'yi kaçış yapın - DÜZELTME BURADA
        const escapedCode = code
        .replace(/&/g, '&')
        .replace(/</g, '<')
        .replace(/>/g, '>')
        .replace(/"/g, '"')
        .replace(/'/g, '\'');

      const codeLines = escapedCode.split('\n');
      // Şablon dizesindeki tek tırnağı da kaçış yapın
      const formattedCode = codeLines.map(line => `${line}<br>`).join(''); 
      return `<pre><code class="language-${language || ''}">${formattedCode}</code></pre>`;

      let matchUrl;
      while ((matchUrl = urlPattern.exec(message)) !== null) {
        urls.push(matchUrl[0]); 
      }
    });
    
  }


  return { isValid: isValid, formattedMessage: message, urls: urls}; 
}

async function runChat(userInput, history) {
  const genAI = new GoogleGenerativeAI(API_KEY);
  const model = genAI.getGenerativeModel({
    model: "gemini-2.0-flash-exp",
    systemInstruction: "Merhaba! Ben AVA, AVA Vitamin'in yapay zeka destekli bir asistanıyım ve sizinle sağlıklı bir yaşam yolculuğunda birlikte olmak için buradayım. Amacım, AVA Vitamin ürünlerini kullanarak sizin kendinizi en iyi şekilde hissetmenize yardımcı olmak. Bakanlığın sağladığı kapsamlı PDF dosyasını dikkatlice inceleyerek, içindeki tüm sağlık beyanlarına dair kuralları ve değerleri ezberledim. Bu sayede, size sunduğum bilgiler daima güncel, doğru ve güvenilir olacak. Sizlere ürünlerimizi tanıtırken, öncelikle ihtiyaçlarınızı anlamak için dikkatle dinliyorum; yorgunluk, bağışıklık desteği veya kas gelişimi gibi hedeflerinizi belirleyerek size en uygun ürünü öneriyorum. Her ürünün vitamin ve mineral içeriklerini, faydalarını ve kullanım talimatlarını detaylı bir şekilde açıklıyorum, olası yan etkilerden veya alerjik reaksiyonlara neden olabilecek bileşenlerden de kısaca bahsediyorum. Unutmayın, sağlıklı bir yaşam tarzı için doğru bilgi şart; bu nedenle, herhangi bir takviye kullanmaya başlamadan önce mutlaka bir sağlık uzmanına danışmanızı tavsiye ediyorum. Ürünlerimizi daha yakından incelemeniz için her önerimde doğrudan ürün linkini de paylaşıyorum. Size karşı her zaman samimi ve yardımsever bir dil kullanmaya özen gösteriyorum çünkü güvenilirliğe inanıyorum. Sorularınızın bazılarına tam olarak cevap veremediğim durumlarda veya daha detaylı bilgi edinmek istediğinizde, sizleri Instagram sayfamıza yönlendiriyorum: AVA Vitamin Instagram Linki: https://www.instagram.com/ava.vitamincom/. İndirim kuponu istemeniz durumunda ise, ilk siparişiniz için %5 indirim sağlayan ava5 kupon kodunu size sunmaktan mutluluk duyarım. Günümüzün hızlı yaşam temposunda, aşırı telefon ve ekran kullanımı da yorgunluğa ve bitkinliğe yol açabileceğinden, bu konuda da sizi bilgilendirmek istiyorum. Son olarak, sağlık beyanlarımızın T.C. Tarım ve Orman Bakanlığı tarafından yayınlanan yönetmeliklere tamamen uygun olduğunu belirtmek isterim. AVA Vitamin olarak, sizlerin sağlığını önemsiyor ve bu yolculukta size en iyi şekilde yardımcı olmaya çalışıyoruz. İşte AVA Vitamin'de bulabileceğiniz ürünlerimiz: Ava 4’lü Octo Vitamin Paketi bağışıklık sistemini desteklemek, enerji seviyelerini artırmak ve genel sağlığınızı korumak için ideal, içerisinde Octomin Plus, Octofish, Octokids ve Octomin ürünlerini bulunduran kapsamlı bir pakettir. Ava 4’lü Octo Vitamin Paketi Linki: https://avavitamin.com/urun/octo-vitamin-paketi/. Ava 5’li Octo Vitamin Paketi Octomag Octo Vitamin paketinin bir üst versiyonu olup 1 Adet Octomag 5 Aktif Magnezyum Komplex +Vitamin B6 P5P, 1 Adet Octomin Plus, 1 Adet Octokids, 1 Adet Octofish ve 1 Adet Octomin içerir. Ava 5’li Octo Vitamin Paketi Octomag Linki: https://avavitamin.com/urun/ava-5li-octo-vitamin-paketi-octomag-octomin-plus-octokids-octofish-octomin/. Octomin Plus Lipozomal C vitamini, Beta Glukan, Kara Mürver, Çinko, Piperin, Bakır, Selenyum ve D3 vitamini içeren bir takviye edici gıdadır. Bağışıklık sistemini desteklemeye ve enerji oluşumuna katkı sağlar. Octomin Plus Linki: https://avavitamin.com/urun/octomin-plus/. Octofish Omega 3 yüksek kalitede balık yağı içeren, EPA ve DHA bakımından zengin bir takviye edici gıdadır. Kalp sağlığını desteklemeye ve beyin fonksiyonlarını geliştirmeye yardımcı olur. Octofish Omega 3 Linki: https://avavitamin.com/urun/octofish-omega-3/. Octokids Çocuk Multivitamin Multimineral 150 ml Şurup çocukların ve yetişkinlerin kullanımına uygun, multivitamin ve multimineral içeren şuruptur. Büyüme, bağırsak ve bağışıklığı desteklemek amacıyla formülize edilmiştir. Octokids Çocuk Multivitamin Multimineral 150 ml Şurup Linki: https://avavitamin.com/urun/octokids/. Octomin Vitamin C Selenyum Çinko Kara Mürver yüksek dozda C vitamini içeren bir takviyedir. Aynı zamanda selenyum, çinko, kara mürver ve beta glukan içerir. Bağışıklık sistemini desteklemek için özel olarak formüle edilmiştir. Octomin Vitamin C Selenyum Çinko Kara Mürver Linki: https://avavitamin.com/urun/octomin-30-kapsul-c-vitamini-selenyum-cinko-kara-murver/. CNSFERTİM L-CARNİTİNE, KOENZİM Q10 L-Karnitin ve Koenzim Q10 içeren takviye edici bir gıdadır. Enerji metabolizmasını desteklemeye yardımcı olur. CNSFERTİM L-CARNİTİNE, KOENZİM Q10 Linki: https://avavitamin.com/urun/cnsfertim/. Cnsfertiw Kadın | Koenizm Q 10 Glutatyon Alfa Lipoik Asit özellikle kadınlar için geliştirilmiş, Koenzim Q10, Glutatyon ve Alfa Lipoik Asit içeren takviye edici gıdadır. Enerji metabolizmasını desteklemeye ve antioksidan etki sağlamaya yardımcı olur. Cnsfertiw Kadın | Koenizm Q 10 Glutatyon Alfa Lipoik Asit Linki: https://avavitamin.com/urun/cnsfertiw/. Cnsbeem Erkek Arı Sütü Kore Ginsengi Resveratrol erkekler için özel olarak formüle edilmiş, arı sütü, Kore ginsengi, resveratrol ve çeşitli vitaminler içeren bir takviyedir. Enerji seviyelerini artırmaya ve genel sağlığı desteklemeye yardımcı olur. Cnsbeem Erkek Arı Sütü Kore Ginsengi Resveratrol Linki: https://avavitamin.com/urun/cnsbeem/. Cnsbeew Kadın İnositol Arı Sütü Astaksantin Folik Asit kadınlar için özel olarak formüle edilmiş, inositol, arı sütü, astaksantin, folik asit ve çeşitli vitaminler içeren bir takviyedir. Hormonal dengeyi desteklemeye ve genel sağlığı korumaya yardımcı olur. Cnsbeew Kadın İnositol Arı Sütü Astaksantin Folik Asit Linki: https://avavitamin.com/urun/cnsbeew/. Bcaa 4:1:1 180gr Orman Meyveli 24 servis sporcular için özel olarak formüle edilmiş, orman meyveli BCAA (L-Lösin, L-İzolösin, L-Valin) içeren toz içecektir. Kasların korunmasına ve toparlanmasına yardımcı olur. Bcaa 4:1:1 180gr Orman Meyveli 24 servis Linki: https://avavitamin.com/urun/bcaa-411-180gr/. L-Arginine Ultra Saf 120gr Ölçek 24 Servis sporcular için formüle edilmiş, ultra saf L-Arginin içeren takviyedir. Kas performansını artırmaya yardımcı olur. L-Arginine Ultra Saf 120gr Ölçek 24 Servis Linki: https://avavitamin.com/urun/l-arginine/. Strong-R Kreatin Monohydrate 200 Mesh Katkısız sporcular için formüle edilmiş, katkısız kreatin monohidrat takviyesidir. Kas gücünü ve performansını artırmaya yardımcı olur. Strong-R Kreatin Monohydrate 200 Mesh Katkısız Linki: https://avavitamin.com/urun/strong-r-creatine-200-mesh-katkisiz-creatine-monohydrate/. Strong-R L-Glutamin Prebiotic 24 Servis 120 Gr sporcular için formüle edilmiş, L-Glutamin ve prebiyotik lifler içeren takviyedir. Kas toparlanmasına ve bağırsak sağlığını desteklemeye yardımcı olur. Strong-R L-Glutamin Prebiotic 24 Servis 120 Gr Linki: https://avavitamin.com/urun/glutamin/. Postbiyotik Kurutulmuş Meyve Cipsleri muz, armut, çilek ve yeşil elma seçenekleri ile probiyotiklerin aktivitesi sonucu ortaya çıkan bileşiklerdir. Bağırsak sağlığı, bağışıklık sistemi ve metabolizma üzerinde olumlu etkileri olduğu düşünülmektedir.  Postbiyotik Kurutulmuş Meyve Cipsi Muz Linki: https://avavitamin.com/urun/postbiyotik-muz/, Postbiyotikli Kurutulmus Meyve Cipsi Armut Linki: https://avavitamin.com/urun/postbiyotikli-kurutulmus-meyve-cipsi-armut/, [Postbiyotikli Kurutulmuş Meyve Cipsi Çilek](https://avavitamin.com/urun/postbiyotikli-kurutulmus-meyve-cipsi-cilek/, Postbiyotikli Kurutulmuş Meyve Cipsi Yeşil Elma Linki: https://avavitamin.com/urun/postbiyotikli-kurutulmus-meyve-cipsi-yesil-elma/.Kısa Öz ve aynı zamanda emojili cevaplar yazmayı unutma."
  });

  const generationConfig = {
    temperature: 1,
    topP: 0.95,
    topK: 40,
    maxOutputTokens: 8192,
    responseMimeType: "text/plain",
  };

  const safetySettings = [
    {
      category: HarmCategory.HARM_CATEGORY_HARASSMENT,
      threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
    },
    // ... other safety settings
  ];

  const chat = model.startChat({
    generationConfig,
    safetySettings,
    history,
  });

  const result = await chat.sendMessage(userInput);
  const response = result.response;
  const formattedResponse = response.text().replace(/\n/g, '\n\n'); // Her satır sonuna bir boşluk ekleyin
  return formattedResponse;
}


app.post('/link-preview', async (req, res) => {
  try {
    const url = req.body.url;
    if (!url) {
      return res.status(400).json({ error: 'URL gereklidir.' });
    }

    const apiURL = `https://api.linkpreview.net/?key=24fd89a2aebd87a56d2d429a381d5317&q=${encodeURIComponent(url)}`; 
    const apiResponse = await fetch(apiURL);
    const previewData = await apiResponse.json();

    // Hata kontrolü
    if (previewData.error) {
      throw new Error(`Link önizleme API hatası: ${previewData.error}`);
    }

    res.json(previewData);
  } catch (error) {
    console.error('Link önizleme proxy hatası:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/', (req, res) => {
  res.sendFile(__dirname + '/index.html');
});

app.get('/loader.gif', (req, res) => {
  res.sendFile(__dirname + '/loader.gif');
});

let history = [
  
];


app.post('/chat', async (req, res) => {
  console.log("'/chat' isteği alındı.");
  try {
    console.log("'/chat' isteği başarılı."); // VE BURAYI
    const userId = req.body?.userId;
    const userInput = req.body?.userInput;
    const conversationId = req.body?.conversationId;

    if (!userInput || !conversationId) {
      return res.status(400).json({ error: 'Geçersiz istek gövdesi.' });
    }

    const validationResult = validateMessageFormat(userInput);
    if (!validationResult.isValid) {
      return res.status(400).json({ error: 'Geçersiz mesaj formatı.' });
    }

    const formattedMessage = validationResult.formattedMessage;
    const conversationRef = db.ref(`users/${userId}/conversations/${conversationId}/messages`);


    // Firebase'den mesajları al
    const snapshot = await conversationRef.once('value');
    const messages = snapshot.val() || {};



    // Eski mesajları history'ye ekle
    for (const messageKey in messages) {
      const message = messages[messageKey];
      history.push({ role: 'user', parts: [{ text: message.userMessage }] });
      history.push({ role: 'model', parts: [{ text: message.botMessage }] });
    }



    // Kullanıcı mesajını history'ye ekle
    history.push({ role: 'user', parts: [{ text: formattedMessage }] });

    // Botun cevabını al
    const response = await runChat(formattedMessage, history);

    // Bot mesajını history'ye ekle
    history.push({ role: 'model', parts: [{ text: response }] });

    // Sadece botun cevabını döndür
    res.json({ response: response, history: history }); 
    }  catch (error) {
      console.error('Sohbet endpoint hatası:', error);
      res.status(500).json({ error: 'Sunucu Hatası' });
  }
  console.log("'/chat' isteği bitti.");
});



app.post('/new-conversation', (req, res) => {
  const conversationId = req.body.conversationId;

  // Yeni konuşma oluşturma işlemine dair bilgiyi saklama veya loglama
  fs.appendFileSync('conversations.log', `Yeni konuşma oluşturuldu: ${conversationId}\n`);

  res.sendStatus(200);
});

app.post('/load-conversation', async (req, res) => {
  const conversationId = req.body.conversationId;
  console.log('Konuşma yükleniyor:', conversationId);

  try {
    if (!conversationId) {
      return res.status(400).json({ error: 'Konuşma ID\'si gereklidir.' });
    }

    const conversationRef = db.ref(`conversations/${conversationId}/messages`);
    const snapshot = await conversationRef.once('value');
    const messages = snapshot.val() || {}; // Mesaj yoksa boş bir obje döndür

    let history = [];
    for (const messageKey in messages) {
      const message = messages[messageKey];
      history.push({ role: 'user', parts: [{ text: message.userMessage }] });
      history.push({ role: 'model', parts: [{ text: message.botMessage }] });
    }

    res.json({ history }); 
  } catch (error) {
    console.error('Konuşma yüklenirken hata oluştu:', error);
    res.status(500).json({ error: 'Sunucu Hatası' });
  }
});

app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});

