import express from "express";
import { createServer } from "node:http";
import "dotenv/config";

const app = express();
const server = createServer(app);

app.use(express.json());

app.get("/", (req, res) => {
  res.send("<h1>Hello World!</h1>");
});

server.listen(3000, () => {
  console.log(`Server is running at ${process.env.PORT}`);
});
