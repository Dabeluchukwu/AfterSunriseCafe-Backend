import "dotenv/config";
import mongoose from "mongoose";
import connectDB from "../config/db.js";
import Admin from "../models/Admin.js";
import Product from "../models/Product.js";
import Message from "../models/Message.js";

await connectDB();

const importData = async () => {
  try {
    const existing = await Admin.findOne({ email: process.env.ADMIN_EMAIL });
    if (existing) {
      console.log(`ℹ️  Admin already exists: ${existing.email}`);
    } else {
      await Admin.create({
        name: process.env.ADMIN_NAME,
        email: process.env.ADMIN_EMAIL,
        password: process.env.ADMIN_PASSWORD,
      });
      console.log(`✅ Admin created: ${process.env.ADMIN_EMAIL}`);
    }
    process.exit(0);
  } catch (error) {
    console.error(`❌ Seeder error: ${error.message}`);
    process.exit(1);
  }
};

const destroyData = async () => {
  try {
    await Promise.all([
      Admin.deleteMany(),
      Product.deleteMany(),
      Message.deleteMany(),
    ]);
    console.log("🗑️  All data destroyed");
    process.exit(0);
  } catch (error) {
    console.error(`❌ Destroy error: ${error.message}`);
    process.exit(1);
  }
};

if (process.argv[2] === "-d") {
  await destroyData();
} else {
  await importData();
}

// (mongoose.connect inside connectDB keeps the process alive; we exit explicitly)
await mongoose.connection.close();