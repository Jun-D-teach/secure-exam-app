import { authTables } from "@convex-dev/auth/server";
import { defineSchema, defineTable } from "convex/server";
import { Infer, v } from "convex/values";

// default user roles. can add / remove based on the project as needed
export const ROLES = {
  ADMIN: "admin",
  USER: "user",
  MEMBER: "member",
  TEACHER: "teacher",
  STUDENT: "student",
} as const;

export const roleValidator = v.union(
  v.literal(ROLES.ADMIN),
  v.literal(ROLES.USER),
  v.literal(ROLES.MEMBER),
  v.literal(ROLES.TEACHER),
  v.literal(ROLES.STUDENT),
);
export type Role = Infer<typeof roleValidator>;

const schema = defineSchema(
  {
    // default auth tables using convex auth.
    ...authTables, // do not remove or modify

    // the users table is the default users table that is brought in by the authTables
    users: defineTable({
      name: v.optional(v.string()), // name of the user. do not remove
      image: v.optional(v.string()), // image of the user. do not remove
      email: v.optional(v.string()), // email of the user. do not remove
      emailVerificationTime: v.optional(v.number()), // email verification time. do not remove
      isAnonymous: v.optional(v.boolean()), // is the user anonymous. do not remove

      role: v.optional(roleValidator), // role of the user. do not remove
    }).index("email", ["email"]), // index for the email. do not remove or modify

    // Exams created by teachers. The actual questions live in a Google Form;
    // this app wraps the form with login, timing, and anti-cheat monitoring.
    exams: defineTable({
      title: v.string(),
      subject: v.optional(v.string()),
      description: v.optional(v.string()),
      googleFormUrl: v.string(),
      durationMinutes: v.number(),
      isActive: v.boolean(),
      // Scheduled window: when students may start the exam. Both optional —
      // leave unset for an always-open exam. startsAt = window opens,
      // endsAt = last moment a new attempt may begin (in-progress attempts
      // keep running until their own timer ends).
      startsAt: v.optional(v.number()),
      endsAt: v.optional(v.number()),
      createdBy: v.id("users"),
      createdAt: v.number(),
    }).index("by_creator", ["createdBy"]),

    // One attempt per student per exam. Server-authoritative timing: endsAt is
    // fixed when the attempt starts, so refresh/close cannot extend the time.
    examAttempts: defineTable({
      examId: v.id("exams"),
      studentId: v.id("users"),
      status: v.union(
        v.literal("in_progress"),
        v.literal("completed"),
        v.literal("expired"),
      ),
      startedAt: v.number(),
      endsAt: v.number(),
      completedAt: v.optional(v.number()),
      violationCount: v.number(),
      violations: v.array(
        v.object({
          type: v.string(),
          at: v.number(),
        }),
      ),
    })
      .index("by_exam", ["examId"])
      .index("by_student", ["studentId"])
      .index("by_exam_student", ["examId", "studentId"]),
  },
  {
    schemaValidation: false,
  },
);

export default schema;
