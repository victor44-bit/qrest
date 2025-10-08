import mongoose, { Schema, type InferSchemaType, type Model } from 'mongoose'

const ReactionSchema = new Schema({
  like: { type: Number, default: 0 },
  fire: { type: Number, default: 0 },
  idea: { type: Number, default: 0 },
}, { _id: false })

const ContributionSchema = new Schema({
  text: { type: String, required: true, maxlength: 240 },
  author: { type: String, default: null },
  likes: { type: Number, default: 0 },
  reactions: { type: ReactionSchema, default: () => ({}) },
  createdAt: { type: Date, default: Date.now },
  deletedAt: { type: Date, default: null },
}, { _id: true })

const ChainSchema = new Schema({
  title: { type: String, required: true, maxlength: 160 },
  tags: { type: [String], default: [] },
  likes: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now },
  deletedAt: { type: Date, default: null },  // default so new docs are included
  contributions: { type: [ContributionSchema], default: [] },
})

// --- Types for the model ---
export type ChainType = InferSchemaType<typeof ChainSchema>
export type ChainDoc = mongoose.HydratedDocument<ChainType>

// ✅ Typed model — no more union
export const Chain: Model<ChainType> =
  (mongoose.models.Chain as Model<ChainType>) ||
  mongoose.model<ChainType>('Chain', ChainSchema)
