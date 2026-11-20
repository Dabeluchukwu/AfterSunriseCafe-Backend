import Product from "../models/Product.js";
import { uploadToR2, deleteFromR2 } from "../utils/r2.js";

// @desc    Get all products (supports ?category=, ?search=)
// @route   GET /api/products
// @access  Public
export const getProducts = async (req, res, next) => {
  try {
    const { category, search } = req.query;
    const filter = {};
    if (category) filter.category = category;
    if (search) filter.title = { $regex: search, $options: "i" };

    const products = await Product.find(filter).sort({ createdAt: -1 });
    res.json(products);
  } catch (error) {
    next(error);
  }
};

// @desc    Get distinct categories
// @route   GET /api/products/categories
// @access  Public
export const getCategories = async (req, res, next) => {
  try {
    const categories = await Product.distinct("category");
    res.json(categories.sort((a, b) => a.localeCompare(b)));
  } catch (error) {
    next(error);
  }
};

// @desc    Get single product
// @route   GET /api/products/:id
// @access  Public
export const getProductById = async (req, res, next) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) {
      res.status(404);
      throw new Error("Product not found");
    }
    res.json(product);
  } catch (error) {
    next(error);
  }
};

// @desc    Create product (multipart/form-data)
// @route   POST /api/products
// @access  Private
export const createProduct = async (req, res, next) => {
  try {
    const { title, category, description, price } = req.body;

    if (!req.file) {
      res.status(400);
      throw new Error("Image is required");
    }
    if (!title || !category || !description || price === undefined) {
      res.status(400);
      throw new Error("Title, category, description, and price are required");
    }

    const { url, key } = await uploadToR2(
      req.file.buffer,
      req.file.originalname,
      req.file.mimetype
    );

    const product = await Product.create({
      title: title.trim(),
      category: category.trim(),
      description: description.trim(),
      price: Number(price),
      imageUrl: url,
      imageKey: key,
    });

    res.status(201).json(product);
  } catch (error) {
    next(error);
  }
};

// @desc    Update product (optional new image)
// @route   PUT /api/products/:id
// @access  Private
export const updateProduct = async (req, res, next) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) {
      res.status(404);
      throw new Error("Product not found");
    }

    const { title, category, description, price } = req.body;

    if (title !== undefined) product.title = title.trim();
    if (category !== undefined) product.category = category.trim();
    if (description !== undefined) product.description = description.trim();
    if (price !== undefined) product.price = Number(price);

    if (req.file) {
      // Upload new, then delete old (best-effort)
      const oldKey = product.imageKey;
      const { url, key } = await uploadToR2(
        req.file.buffer,
        req.file.originalname,
        req.file.mimetype
      );
      product.imageUrl = url;
      product.imageKey = key;
      if (oldKey) {
        deleteFromR2(oldKey).catch((e) =>
          console.warn("R2 old-image delete failed:", e.message)
        );
      }
    }

    const updated = await product.save();
    res.json(updated);
  } catch (error) {
    next(error);
  }
};

// @desc    Delete product (also deletes image from R2)
// @route   DELETE /api/products/:id
// @access  Private
export const deleteProduct = async (req, res, next) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) {
      res.status(404);
      throw new Error("Product not found");
    }

    if (product.imageKey) {
      deleteFromR2(product.imageKey).catch((e) =>
        console.warn("R2 delete failed:", e.message)
      );
    }

    await product.deleteOne();
    res.json({ message: "Product deleted" });
  } catch (error) {
    next(error);
  }
};

// @desc    Bulk-rename a category across all products
// @route   PUT /api/products/categories/rename
// @access  Private
export const renameCategory = async (req, res, next) => {
  try {
    const { oldCategory, newCategory } = req.body;

    if (!oldCategory || !newCategory) {
      res.status(400);
      throw new Error("oldCategory and newCategory are required");
    }
    if (oldCategory.trim() === newCategory.trim()) {
      res.status(400);
      throw new Error("New category must be different from old category");
    }

    const result = await Product.updateMany(
      { category: oldCategory.trim() },
      { $set: { category: newCategory.trim() } }
    );

    res.json({
      message: `Renamed "${oldCategory}" → "${newCategory}"`,
      matched: result.matchedCount,
      modified: result.modifiedCount,
    });
  } catch (error) {
    next(error);
  }
};