import mongoose, { Schema, Document, Model } from "mongoose";

export type BlogStatus = "draft" | "published";

export interface IGeneratedBlog extends Document {
  topic: string;
  trendQuery: string;
  title: string;
  content: string;
  imagePrompt: string;
  imageUrl: string;
  externalUrl?: string;
  status: BlogStatus;
  createdAt: Date;
  updatedAt: Date;
}

const GeneratedBlogSchema = new Schema<IGeneratedBlog>(
  {
    topic: {
      type: String,
      required: true,
      enum: [
        "IT & Technology",
        "Brand Awareness",
        "Automation Systems",
        "ERP-CRM-HRMS",
      ],
    },
    trendQuery: {
      type: String,
      required: true,
    },
    title: {
      type: String,
      required: true,
    },
    content: {
      type: String,
      required: true,
    },
    imagePrompt: {
      type: String,
      required: true,
    },
    imageUrl: {
      type: String,
      default: "",
    },
    externalUrl: {
      type: String,
      default: "",
    },
    status: {
      type: String,
      enum: ["draft", "published"],
      default: "draft",
    },
  },
  {
    timestamps: true,
  }
);

const GeneratedBlog: Model<IGeneratedBlog> =
  mongoose.models.GeneratedBlog ||
  mongoose.model<IGeneratedBlog>("GeneratedBlog", GeneratedBlogSchema);

export default GeneratedBlog;
