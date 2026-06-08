const { PrismaClient } = require('@prisma/client');

// Usamos DIRECT_URL para evitar errores de prepared statements (PgBouncer de Supabase)
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DIRECT_URL || process.env.DATABASE_URL
    }
  }
});

async function main() {
  console.log("Conectando a base de datos via DIRECT_URL...");
  const count = await prisma.estacionamiento.count();
  if (count === 0) {
    console.log("La base de datos está vacía. Insertando estacionamiento de prueba...");
    const p1 = await prisma.estacionamiento.create({
      data: {
        nombre: "Estacionamiento Central",
        ubicacion_gps: "Calle Principal 123",
        ocupado_a: false,
        ocupado_b: false,
        reservado_a: false,
        reservado_b: false
      }
    });
    console.log("✅ Estacionamiento de prueba creado:", p1);
  } else {
    const all = await prisma.estacionamiento.findMany();
    console.log("✅ La base de datos ya tiene registros:", all);
  }
}

main()
  .catch((e) => {
    console.error("❌ Error en el sembrado de base de datos:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
