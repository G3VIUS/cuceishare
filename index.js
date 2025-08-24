const express = require('express');
const swaggerUi = require("swagger-ui-express");
const swaggerJsdoc = require("swagger-jsdoc");
const cors = require('cors');
const app = express();

const options = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "API de CUCEIShare",
      version: "1.0.0",
      description: "Documentación de la API con Swagger",
    },
  },
  apis: ["./routes/*.js"], // aquí leerá los comentarios de tus rutas
};

const specs = swaggerJsdoc(options);
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(specs));

app.use(cors());
app.use(express.json());

const apuntesRoutes = require('./routes/apuntes');
app.use('/apuntes', apuntesRoutes);

app.get('/', (req, res) => {
  res.send('CUCEIShare API funcionando 🎓');
});

const PORT = 3001;
app.listen(PORT, () => {
  console.log(`Servidor escuchando en http://localhost:${PORT}`);
});
