const express = require('express');
const mongoose = require('mongoose');
const multer = require('multer');
const Tesseract = require('tesseract.js');
require('dotenv').config(); 

const path = require('path');
const File = require('./models/user');

const app = express();
const PORT = process.env.PORT || 3000;

const uri = process.env.MONGODB_URI;
mongoose.connect(uri)
.then(() => console.log('Connected to MongoDB'))
.catch((err) => console.error('MongoDB connection error:', err));



const storage = multer.diskStorage({
  destination: (req, file,cb) =>{
       cb(null, 'uploads/');
  },
  filename: (req,file,cb )=>{
       cb(null, `${Date.now()}-${file.originalname}`);
  },
});


app.get('/', (req, res) => {
    res.send('Hello World!')
  });



const upload = multer({
  storage: storage,
  fileFilter: (req, file, cb) => {
    // Allow only image files
    const fileTypes = /jpeg|jpg|png|gif/;
    const extName = fileTypes.test(path.extname(file.originalname).toLowerCase());
    const mimeType = fileTypes.test(file.mimetype);

    if (mimeType && extName) {
      return cb(null, true);
    } else {
      cb(new Error('Only images are allowed!'));
    }
  },
  limits: { fileSize: 5 * 1024 * 1024 }, // File size limit: 5MB
});
app.post('/upload', upload.single('file'), async (req, res) => {
  try {
    // Check if the file is uploaded
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }

    // Run OCR on the uploaded image to extract text
    const { data: { text } } = await Tesseract.recognize(req.file.path, 'eng', {
      logger: (m) => console.log(m),
    });
    const extractedInfo = extractAadhaarInfo(text);

    // Save file details and extracted information to MongoDB
    const newFile = new File({
      filename: req.file.filename,
      originalName: req.file.originalname,
      path: req.file.path,
      size: req.file.size,
      name: extractedInfo.name,
      aadhaarNumber: extractedInfo.aadhaarNumber,
    });

    await newFile.save();

    // Send response with the file details
    res.status(200).json({
      message: 'File uploaded and information saved successfully',
      file: req.file,
      extractedInfo,
    });
  } catch (error) {
    console.error('Error processing OCR:', error);
    res.status(500).json({ error: error.message });
  }
});


function extractAadhaarInfo(text) {
  const nameRegex = /Name\s*:\s*([A-Z\s]+)/i;
  const aadhaarRegex = /\b\d{4}\s\d{4}\s\d{4}\b/;

  const nameMatch = text.match(nameRegex);
  const aadhaarMatch = text.match(aadhaarRegex);

  return {
    name: nameMatch ? nameMatch[1].trim() : 'Not Found',
    aadhaarNumber: aadhaarMatch ? aadhaarMatch[0].trim() : 'Not Found',
  };
}


app.listen(PORT, ()=>{
    console.log('listening on port 3000');
});
