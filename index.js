const express = require('express');
const cors = require('cors');
const app = express();

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
