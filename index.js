require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const dns = require('dns');
const { MongoClient } = require('mongodb');
const { URL } = require('url');

const app = express();

// Configurazione di base
const port = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(bodyParser.urlencoded({ extended: false }));
app.use('/public', express.static(process.cwd() + '/public'));  // Serve i file statici nella cartella "public"

// Connessione a MongoDB
const client = new MongoClient(process.env.MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true });
let urls;

client.connect().then(() => {
  const db = client.db('shorturl');
  urls = db.collection('urls');
  console.log('Connesso a MongoDB');
});

// Route principale che serve il file statico "index.html"
app.get('/', (req, res) => {
  res.sendFile(process.cwd() + '/views/index.html');  
});

// POST: Creazione di uno short URL
app.post('/api/shorturl', async (req, res) => {
  const original_url = req.body.url;

  try {
    // Verifica validità dell'URL
    const parsedUrl = new URL(original_url);
    if (!/^https?:/.test(parsedUrl.protocol)) {
      return res.json({ error: 'invalid url' });
    }

    // Risolvi l'hostname
    dns.lookup(parsedUrl.hostname, async (err) => {
      if (err) {
        return res.json({ error: 'invalid url' });
      }

      // Trova l'ultimo valore di `short_url` nel database e genera un nuovo ID
      const maxShortUrl = await urls.find().sort({ short_url: -1 }).limit(1).toArray();
      const nextShortUrl = maxShortUrl.length > 0 ? maxShortUrl[0].short_url + 1 : 1;  // Se non ci sono record, parte da 1

      // Inserisci il nuovo URL nel database con il `short_url` generato
      const result = await urls.insertOne({ original_url, short_url: nextShortUrl });
      // Rispondi con l'original_url e short_url creato
      res.json({ original_url: original_url, short_url: nextShortUrl });
    });
  } catch (err) {
    res.json({ error: 'invalid url' });  // Gestisci l'errore
  }
});

// GET: Reindirizza al URL originale
app.get('/api/shorturl/:short_url', async (req, res) => {
  const short_url = parseInt(req.params.short_url, 10);
  // Cerca l'URL corrispondente nel database
  const urlEntry = await urls.findOne({ short_url: short_url });
  if (urlEntry) {
    res.redirect(urlEntry.original_url);
  } else {
    res.status(404).json({ error: 'invalid url' });
  }
});

// Avvia il server
app.listen(port, () => {
  console.log(`Listening on port ${port}`);
});
