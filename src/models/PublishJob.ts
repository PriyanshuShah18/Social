import mongoose, { Schema, Document, Model } from "mongoose";

export type PublishStatus = "processing" | "success" | "partial" | "failed";

export interface IPublishResult {
  channel: string;
  success: boolean;
  platformPostId?: string;
  error?: string;
  accountId?: mongoose.Types.ObjectId;
}

export interface IPublishJob extends Document {
  title?: string;
  text: string;
  link?: string;
  mediaUrls: string[];
  channels: string[];
  status: PublishStatus;
  results: IPublishResult[];
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

const PublishResultSchema = new Schema<IPublishResult>(
  {
    channel: { type: String, required: true },
    success: { type: Boolean, required: true },
    platformPostId: { type: String },
    error: { type: String },
    accountId: { type: Schema.Types.ObjectId, ref: "ConnectedAccount" },
  },
  { _id: false }
);

const PublishJobSchema = new Schema<IPublishJob>(
  {
    title: { type: String },
    text: { type: String, required: true },
    link: { type: String },
    mediaUrls: [{ type: String }],
    channels: [{ type: String }],
    status: {
      type: String,
      default: "processing",
      enum: ["processing", "success", "partial", "failed"],
    },
    results: [PublishResultSchema],
    createdBy: { type: String, default: "default" },
  },
  { timestamps: true }
);

const PublishJob: Model<IPublishJob> =
  mongoose.models.PublishJob ||
  mongoose.model<IPublishJob>("PublishJob", PublishJobSchema);

export default PublishJob;
