import { ArchitectAgent } from "./architect.js";
import type { ArchitectModel } from "./architect.js";
import { architectureResultSchema } from "./schema.js";

const fakeModel: ArchitectModel = {
  async generateStructured<T>(_systemPrompt: string, _userPrompt: string, _schema: unknown): Promise<T> {
    return {
      title: "Event-Driven Notification System",
      summary: "Design for async notification processing via event queue.",
      components: [
        {
          name: "NotificationProducer",
          type: "new",
          description: "Publishes notification events on status change.",
          responsibilities: ["Validate payload", "Publish to queue"],
        },
        {
          name: "NotificationConsumer",
          type: "new",
          description: "Consumes queue messages and dispatches emails.",
          responsibilities: ["Consume event", "Format email", "Send via Provider"],
        },
      ],
      dataFlow: [
        "API -> NotificationProducer -> Queue -> NotificationConsumer -> Email Provider",
      ],
      dependencies: ["amqplib", "nodemailer"],
      risks: ["Queue overflow during email gateway outages."],
      verificationPlan: [
        "Unit test event publisher.",
        "Integration test consumer with mock queue.",
      ],
    } as unknown as T;
  },
};

async function main() {
  const architect = new ArchitectAgent(fakeModel);

  const result = await architect.design(
    "Design notification system for Aegis tasks"
  );

  console.log("Architect result:");
  console.log(JSON.stringify(result, null, 2));

  architectureResultSchema.parse(result);

  console.log("✓ Architect output is valid");
}

main().catch((error) => {
  console.error("Architect test failed:", error);
  process.exit(1);
});
