import "dotenv/config";
import { app } from "./app.ts";

const port = Number(process.env.PORT ?? 3000);

app.listen(port, () => {
  console.log(`SchoolERP TypeScript server listening at http://127.0.0.1:${port}`);
});