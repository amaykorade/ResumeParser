import express from 'express';
import expressEjsLayouts from 'express-ejs-layouts';
import path from 'path';
import UploadController from './src/controllers/upload.controller.js';
import multer from 'multer';
import { fileURLToPath } from 'url';
import cors from 'cors';

const app = express();

// Get __dirname equivalent in ES Modules
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Set up CORS middleware
app.use(cors());

// Configure multer for file upload
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, path.join(__dirname, 'uploads'));  // Use __dirname equivalent here
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + path.extname(file.originalname));
    },
});

const upload = multer({ storage });

// Parse form data
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Setup view engine
app.set("view engine", "ejs");
app.set("views", path.join(path.resolve(), 'src', 'views'));
app.use(expressEjsLayouts);

// Create instance of controller
const uploadController = new UploadController();

// Routes
app.get('/', uploadController.getUpload);
app.post('/upload', upload.single('resume'), uploadController.upload);

app.post('/analyze', uploadController.analyze);

app.listen(3400, () => {
    console.log(`Server is running on http://localhost:3400`);
});