import jwt from "jsonwebtoken";
import Admin from "../models/Admin.js";

const signAccessToken = (id) =>
  jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_ACCESS_EXPIRES_IN || "2h",
  });

const signRefreshToken = (id) =>
  jwt.sign({ id }, process.env.JWT_REFRESH_SECRET, {
    expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || "30d",
  });

// @desc    Login admin
// @route   POST /api/auth/login
// @access  Public
export const loginAdmin = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      res.status(400);
      throw new Error("Email and password are required");
    }

    const admin = await Admin.findOne({ email: email.toLowerCase().trim() });
    if (!admin || !(await admin.matchPassword(password))) {
      res.status(401);
      throw new Error("Invalid email or password");
    }

    res.json({
      _id: admin._id,
      name: admin.name,
      email: admin.email,
      token: signAccessToken(admin._id),
      refreshToken: signRefreshToken(admin._id),
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Refresh access token using a valid refresh token
// @route   POST /api/auth/refresh
// @access  Public (requires valid refresh token in body)
export const refreshAccessToken = async (req, res, next) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) {
      res.status(400);
      throw new Error("Refresh token is required");
    }

    let decoded;
    try {
      decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
    } catch {
      res.status(401);
      throw new Error("Invalid or expired refresh token");
    }

    const admin = await Admin.findById(decoded.id).select("-password");
    if (!admin) {
      res.status(401);
      throw new Error("Admin no longer exists");
    }

    res.json({
      token: signAccessToken(admin._id),
      refreshToken: signRefreshToken(admin._id), // rotate on refresh
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get logged-in admin profile
// @route   GET /api/auth/me
// @access  Private
export const getMe = async (req, res, next) => {
  try {
    res.json(req.admin);
  } catch (error) {
    next(error);
  }
};