import mongoose from "mongoose";

const productSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    // FREE-TEXT category — admin creates categories on the fly
    category: { type: String, required: true, trim: true },
    description: { type: String, required: true, trim: true },
    imageUrl: { type: String, required: true },
    imageKey: { type: String, required: true }, // R2 object key, used for deletion
    price: { type: Number, required: true, min: 0 },
  },
  { timestamps: true }
);

// Optional: index on category to speed up filtering
productSchema.index({ category: 1 });

const Product = mongoose.model("Product", productSchema);
export default Product;