import { NestFactory } from '@nestjs/core';
import { DynamicMasterModule } from './dynamic-master.module';

async function bootstrap() {
  const app = await NestFactory.create(DynamicMasterModule);
  // Enable global prefix if needed, currently direct mapping
  // app.setGlobalPrefix('api');

  const port = process.env.PORT || 3001;
  await app.listen(port);
  console.log(`Application is running on port: ${port}`);
}
bootstrap().catch((err) => {
  console.error('Error during bootstrap:', err);
});
