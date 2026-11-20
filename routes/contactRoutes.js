import express from "express";
import {
  createMessage,
  getMessages,
  getMessageById,
  markAsRead,
  replyToMessage,
  deleteMessage,
} from "../controllers/contactController.js";
import { protect } from "../middleware/authMiddleware.js";

const router = express.Router();

// Public
router.post("/", createMessage);

// Private
router.get("/", protect, getMessages);
router.get("/:id", protect, getMessageById);
router.put("/:id/read", protect, markAsRead);
router.post("/:id/reply", protect, replyToMessage);
router.delete("/:id", protect, deleteMessage);

export default router;