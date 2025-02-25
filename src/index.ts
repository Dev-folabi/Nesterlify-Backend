import express, { Express, NextFunction, Request, Response } from "express";
import morgan from "morgan";
import cors from "cors";
import dotenv from "dotenv";
import api from "./routes/api";
import connectDB from "./database/db";

// Dotenv config
dotenv.config();

// Initialize express server
const app: Express = express();

// Environmental variables
const port = process.env.PORT || 8081;
const allowedOrigins = [
  "https://nesterlify.com",
  "https://nesterlify-v2.vercel.app",
  "http://localhost:5173",
];

// Middlewares
app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error("Not allowed by CORS"));
      }
    },
    credentials: true,
  })
);
app.use(express.json());
app.use(morgan("combined"));

// Routes
app.get("/", (req: Request, res: Response) => {
  res.send({ message: "NESTERLIFY API" });
});

app.use("/api/v1", api);

app.use("*", (req: Request, res: Response) => {
  res.status(404).send("Error 404");
});

// Error handler
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  const statusCode = err.statusCode || 500;
  const message = err.message || "Internal Server Error";
  res.status(statusCode).json({ success: false, message, data: [] });
});

// app.listen(port, () => {
//   console.log(`⚡️[server]: Server is running at http://localhost:${port}`);
// });
// Database Connection
connectDB()
  .then(() => {
    app.listen(port, () => {
      console.log(`⚡️[server]: Server is running at http://localhost:${port}`);
    });
  })
  .catch((error) => {
    console.error("Failed to start the server:", error);
  });
