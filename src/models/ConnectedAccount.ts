import mongoose, { Schema, Document, Model } from "mongoose";

export type Platform = "linkedin" | "facebook" | "instagram";
export type ScopeType = "personal" | "organization" | "page" | "instagram_business";

export interface IConnectedAccount extends Document {
  platform: Platform;
  scopeType: ScopeType;
  displayName: string;
  externalAccountId: string;
  accessToken: string;
  refreshToken?: string;
  tokenExpiresAt?: Date;
  meta?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

const ConnectedAccountSchema = new Schema<IConnectedAccount>(
  {
    platform: {
      type: String,
      enum: ["linkedin", "facebook", "instagram"],
      required: true,
    },
    scopeType: {
      type: String,
      enum: ["personal", "organization", "page", "instagram_business"],
      required: true,
    },
    displayName: { type: String, required: true },
    externalAccountId: { type: String, required: true },
    accessToken: { type: String, required: true }, // AES-256-GCM encrypted
    refreshToken: { type: String },                // AES-256-GCM encrypted
    tokenExpiresAt: { type: Date },
    meta: { type: Schema.Types.Mixed },
  },
  { timestamps: true }
);

// Index for quick lookups
ConnectedAccountSchema.index({ platform: 1, externalAccountId: 1 }, { unique: true });

const ConnectedAccount: Model<IConnectedAccount> =
  mongoose.models.ConnectedAccount ||
  mongoose.model<IConnectedAccount>("ConnectedAccount", ConnectedAccountSchema);

export default ConnectedAccount;
