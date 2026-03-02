import express from "express";
import cors from "cors";
import { createEmptyTemplate, renderLabelStub, type LabelTemplate } from "@tls/core";

const app = express();
app.use(cors());
app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({ ok: true, service: "@tls/api" });
});

app.get("/templates/default", (_req, res) => {
  res.json(createEmptyTemplate("default-template"));
});

app.post("/render", (req, res) => {
  const template = req.body as LabelTemplate;
  const result = renderLabelStub(template);
  res.json(result);
});

const port = Number(process.env.PORT ?? 3001);
app.listen(port, () => {
  console.log(`@tls/api listening on http://localhost:${port}`);
});
