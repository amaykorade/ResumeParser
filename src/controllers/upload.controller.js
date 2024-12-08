import path from "path";
import fs from "fs";
import pdfParse from "pdf-parse";
import mammoth from "mammoth";
import { GoogleGenerativeAI } from "@google/generative-ai";
import fetch from "node-fetch"; // Ensure node-fetch is installed

// Initialize Google Generative AI client
const API_KEY = "AIzaSyBKCPspKpuq7s86EiC7PEngEaF3EDYOBWo";
const genAI = new GoogleGenerativeAI(API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

// Hugging Face API for similarity model
const url = "https://api-inference.huggingface.co/models/sentence-transformers/all-MiniLM-L6-v2";
const apiKey = "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";

async function sendToGemini(text) {
    const prompt = `
    Extract the following information from this resume text:
    1. Full Name
    2. Contact Information (Phone and Email)
    3. Location
    4. Skills
    5. Education
    6. Work Experience

    Resume Text: ${text}
  `;

    try {
        const result = await model.generateContent(prompt);
        return result.response.text();
    } catch (error) {
        console.error("Error calling Gemini API:", error.message);
        throw error;
    }
}


export default class UploadController {
    getUpload(req, res, next) {
        res.render("upload");
    }

    async upload(req, res, next) {
        if (req.file) {
            const filePath = path.join("uploads", req.file.filename);

            try {
                if (!fs.existsSync(filePath)) {
                    return res.status(404).send("Uploaded file not found");
                }

                let text;
                const fileExtension = path.extname(req.file.originalname).toLowerCase();

                if (fileExtension === ".pdf") {
                    const dataBuffer = fs.readFileSync(filePath);
                    text = await pdfParse(dataBuffer).then((data) => data.text);
                } else if (fileExtension === ".docx") {
                    const { value } = await mammoth.extractRawText({ path: filePath });
                    text = value;
                } else {
                    return res.status(400).send("Unsupported file type.");
                }

                if (!text) {
                    throw new Error("Failed to extract text from the resume.");
                }

                const parseDataDir = path.join("parse-data");
                const parseDataFilePath = path.join(parseDataDir, `${req.file.filename}-parsed.txt`);

                if (!fs.existsSync(parseDataDir)) {
                    fs.mkdirSync(parseDataDir);
                }

                fs.writeFileSync(parseDataFilePath, text);

                const geminiResponse = await sendToGemini(text);

                const formattedDataDir = path.join("formatted-data");
                const formattedDataFilePath = path.join(formattedDataDir, `${req.file.filename}-formatted.txt`);

                if (!fs.existsSync(formattedDataDir)) {
                    fs.mkdirSync(formattedDataDir);
                }

                fs.writeFileSync(formattedDataFilePath, geminiResponse);

                res.json({
                    message: "Data has been parsed, formatted, and compared successfully.",
                    extractedData: geminiResponse,
                    // similarityScore: score,
                });
            } catch (error) {
                console.error("Error processing the file:", error.message);
                res.status(500).send("Error processing the resume.");
            }
        } else {
            res.status(400).send("Error uploading file");
        }
    }

    async analyze(req, res, next) {
        try {
            const { jobDescription, userId } = req.body;
            // console.log(jobDescription, userId);

            if (!jobDescription || !userId) {
                return res.status(400).json({ success: false, message: "Job description or user ID is missing." });
            }

            const resumeFilePath = path.join("parse-data", `${userId}.txt`);
            console.log("resumeFilePath :", resumeFilePath);

            if (!fs.existsSync(resumeFilePath)) {
                return res.status(404).json({
                    success: false,
                    message: "Parsed resume data not found. Please upload the resume again.",
                });
            }

            const reumeData = fs.readFileSync(resumeFilePath, "utf-8");

            const prompt = `
            Compare the following resume and job description. Provide:
            1. A list of matching skills.
            2. The relevance of the candidate's experience to the job description.
            3. Suitability score (0-100).

            Resume:
            ${reumeData}

            Job Description:
            ${jobDescription}
            `;

            const result = await model.generateContent(prompt);

            const analysis = result.response.text();

            res.json({
                success: true,
                message: "Analysis completed successfully",
                analysis: analysis,
            });
        } catch (error) {
            console.error("Error analyzing resume and job description:", error.message);
            res.status(500).json({
                success: false,
                message: "Error analyzing resume and job description.",
            })
        }
    }
}
