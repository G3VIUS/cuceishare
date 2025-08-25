const express = require('express');
const swaggerUi = require("swagger-ui-express");
const swaggerJsdoc = require("swagger-jsdoc");
const rateLimit = require('express-rate-limit');
const cors = require('cors');
const app = express();

const swaggerOptions = {
  swaggerDefinition: {
    openapi: "3.0.0",
    info: {
      title: "Mi API",
      version: "1.0.0",
      description: "API con rutas protegidas usando JWT"
    },
    components: {
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT"
        }
      }
    },
  },
  apis: ["./routes/*.js"], // Aquí van tus rutas documentadas
};
const specs = swaggerJsdoc(swaggerOptions);
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(specs));

const Authlimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minuto
  max: 5, // máximo 5 peticiones por IP
  message: {
    message: "Demasiados intentos, inténtalo de nuevo más tarde"
  }
});

const Applimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minuto
  max: 15, // máximo 15 peticiones por IP
  message: {
    message: "Demasiados intentos, inténtalo de nuevo más tarde"
  }
});

app.use(cors());
app.use(express.json());

const apuntesRoutes = require('./routes/apuntes');
const authRoutes = require('./routes/auth');

app.use('/apuntes', Applimiter, apuntesRoutes);
app.use('/auth', Authlimiter, authRoutes);

app.get('/', (req, res) => {
  res.send('CUCEIShare API funcionando 🎓');
});

const PORT = 3001;
app.listen(PORT, () => {
  console.log(`Servidor escuchando en http://localhost:${PORT}`);
});
