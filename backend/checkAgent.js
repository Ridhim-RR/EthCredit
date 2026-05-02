const prisma = require('./src/db/prisma');
(async () => {
  try {
    const a = await prisma.agent.findUnique({
      where: { agentId: '479c56b015b25e433333dacffcb6e9889efee800ae55b9fd4fb073ba66440ed5' },
      include: { vault: true },
    });
    console.log(JSON.stringify(a, null, 2));
  } catch (e) {
    console.error(e);
  } finally {
    await prisma.$disconnect();
  }
})();
