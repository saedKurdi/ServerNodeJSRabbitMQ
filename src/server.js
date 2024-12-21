import express from "express";
import http from "http";
import { Server } from "socket.io";
import amqp from "amqplib";
import bodyParser from "body-parser";
import cors from "cors";

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: (origin, callback) => {
      const allowedOrigins = ["http://localhost:5173", "http://localhost:5174"];
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error("Not allowed by CORS"));
      }
    },
    methods: ["GET", "POST"],
    allowedHeaders: ["Content-Type"],
  },
});
const port = 5000;

app.use(bodyParser.json());

// Enable CORS for HTTP requests
app.use(
  cors({
    origin: (origin, callback) => {
      const allowedOrigins = ["http://localhost:5173", "http://localhost:5174"];
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error("Not allowed by CORS"));
      }
    },
    methods: ["GET", "POST"],
    allowedHeaders: ["Content-Type"],
  })
);

async function connectToRabbitMQ() {
  const connection = await amqp.connect(
    "amqps://zuduguoa:i3rDng9dw_Zfoa29DkCTQPr04FeDoexR@ostrich.lmq.cloudamqp.com/zuduguoa"
  );
  const channel = await connection.createChannel();
  const queue = "mystepqueue";
  await channel.assertQueue(queue, { durable: true });
  return { connection, channel, queue };
}

io.on("connection", (socket) => {
  console.log("A client connected");
  socket.on("disconnect", () => {
    console.log("A client disconnected");
  });
});

app.post("/send", async (req, res) => {
  const { message } = req.body;
  if (!message) {
    return res.status(400).send({ error: "Message is required" });
  }
  try {
    const { connection, channel, queue } = await connectToRabbitMQ();
    channel.sendToQueue(queue, Buffer.from(message), { persistent: true });
    io.emit("message", message);
    setTimeout(() => {
      channel.close();
      connection.close();
    }, 500);
    res
      .status(200)
      .send({ status: "Message sent to RabbitMQ and broadcasted" });
  } catch (error) {
    console.error("Error sending message to RabbitMQ:", error);
    res.status(500).send({ error: "Failed to send message to RabbitMQ" });
  }
});

server.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});
