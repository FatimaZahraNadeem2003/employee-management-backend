require("express-async-errors");
require("dotenv").config({ path: "./.env" });
const mongoose = require('mongoose');

const requiredEnvVars = ['MONGO_URI', 'JWT_SECRET', 'JWT_LIFETIME', 'PORT'];
const missingEnvVars = requiredEnvVars.filter(envVar => !process.env[envVar]);

if (missingEnvVars.length > 0) {
  console.error('❌ Missing required environment variables:', missingEnvVars);
  process.exit(1);
}

const express = require("express");
const cors = require("cors");
const app = express();

const helmet = require("helmet");
const xss = require("xss-clean");
const rateLimiter = require("express-rate-limit");

const connectDB = require("./db/connect");

const authRouter = require('./routes/auth');
const userRouter = require('./routes/user');

const employeeRoutes = require('./routes/employeeRoutes');
const managerRoutes = require('./routes/managerRoutes');
const projectRoutes = require('./routes/projectRoutes');
const scheduleRoutes = require('./routes/scheduleRoutes');
const assignmentRoutes = require('./routes/assignmentRoutes');
const reportsRoutes = require('./routes/reportsRoutes');

const accountRoutes = require('./routes/accountRoutes');
const calendarRoutes = require('./routes/calendarRoutes');
const messageRoutes = require('./routes/messageRoutes');
const dashboardRoutes = require('./routes/dashboardRoutes');
const notificationRoutes = require('./routes/notificationRoutes');
const libraryRoutes = require('./routes/libraryRoutes');
const feeRoutes = require('./routes/feeRoutes');

const authMiddleware = require('./middleware/authentication');
const { adminMiddleware, managerAuth, employeeAuth } = require('./middleware/authorization');
const notFoundMiddleware = require('./middleware/not-found');
const errorHandlerMiddleware = require('./middleware/error-handler');

app.set('trust proxy', 1);
app.use(
  rateLimiter({
    windowMs: 15 * 60 * 1000,
    max: 100,
    message: 'Too many requests from this IP, please try again after 15 minutes'
  })
);
app.use(helmet());
app.use(cors({
  origin: ['http://localhost:3000', 'http://127.0.0.1:3000'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(xss());

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

app.use("/api/v1/auth", authRouter);
app.use("/api/v1/users", userRouter);

app.use("/api/v1/admin/employees", employeeRoutes);
app.use("/api/v1/admin/projects", projectRoutes);
app.use("/api/v1/admin/schedules", scheduleRoutes);
app.use("/api/v1/admin/assignments", assignmentRoutes);
app.use("/api/v1/admin/reports", reportsRoutes);
app.use("/api/v1/admin/managers", managerRoutes);

app.use("/api/v1/manager", managerRoutes);

app.use("/api/v1/employee", employeeRoutes);

app.use("/api/v1/account", accountRoutes);
app.use("/api/v1/calendar", calendarRoutes);
app.use("/api/v1/messages", messageRoutes);
app.use("/api/v1/dashboard", dashboardRoutes);
app.use("/api/v1/notifications", notificationRoutes);
app.use("/api/v1/library", libraryRoutes);
app.use("/api/v1/fees", feeRoutes);

app.get("/", (req, res) => {
  res.status(200).json({
    success: true,
    msg: "Employee Management System API",
    version: "1.0.0",
    timestamp: new Date().toISOString(),
    status: "Server is running and healthy"
  });
});

app.get("/api/v1", (req, res) => {
  res.status(200).json({
    success: true,
    message: "Employee Management System API",
    status: "healthy",
    endpoints: {
      auth: {
        register: "POST /api/v1/auth/register",
        login: "POST /api/v1/auth/login",
        profile: "GET /api/v1/auth/me"
      }
    }
  });
});

app.get("/api/v1/health", (req, res) => {
  res.status(200).json({
    success: true,
    status: "healthy",
    timestamp: new Date().toISOString(),
    message: "Backend is running and accessible"
  });
});

app.use(notFoundMiddleware);
app.use(errorHandlerMiddleware);

const port = process.env.PORT || 5000;

const start = async () => {
  try {
    await connectDB();
    
    const server = app.listen(port, () => {
      console.log(`✅ Server is running on port ${port}`);
    });

    server.on('error', (error) => {
      console.error('❌ Server error:', error);
      if (error.code === 'EADDRINUSE') {
        console.error(`❌ Port ${port} is already in use`);
        process.exit(1);
      }
    });

    process.on('uncaughtException', (error) => {
      console.error('❌ Uncaught Exception:', error);
    });

    process.on('unhandledRejection', (error) => {
      console.error('❌ Unhandled Rejection:', error);
    });

    process.on('SIGTERM', () => {
      console.log('🔄 SIGTERM received, closing server...');
      server.close(() => {
        console.log('✅ Server closed');
        mongoose.connection.close(false, () => {
          process.exit(0);
        });
      });
    });

    process.on('SIGINT', () => {
      console.log('🔄 SIGINT received, closing server...');
      server.close(() => {
        console.log('✅ Server closed');
        mongoose.connection.close(false, () => {
          process.exit(0);
        });
      });
    });

  } catch (error) {
    console.error('❌ Server startup error:', error);
    process.exit(1);
  }
};

start();