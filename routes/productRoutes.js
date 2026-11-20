import express from "express";
import {
  getProducts,
  getCategories,
  getProductById,
  createProduct,
  updateProduct,
  deleteProduct,
  renameCategory,
} from "../controllers/productController.js";
import { protect } from "../middleware/authMiddleware.js";
import { upload } from "../middleware/upload.js";

const router = express.Router();

// Public
router.get("/", getProducts);
router.get("/categories", getCategories); // must be before /:id
router.get("/:id", getProductById);

// Private (admin)
router.post("/", protect, upload.single("image"), createProduct);
router.put("/categories/rename", protect, renameCategory);
router.put("/:id", protect, upload.single("image"), updateProduct);
router.delete("/:id", protect, deleteProduct);

export default router;