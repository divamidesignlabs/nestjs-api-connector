import { NestFactory } from '@nestjs/core';
import { CorrectorModule } from './corrector/corrector.module';

async function bootstrap() {
  const app = await NestFactory.create(CorrectorModule.forRoot({
    mappingRepository: {} as any, // Only for demo compilation
  }));

  const port = process.env.PORT || 3001;
  await app.listen(port);
  console.log(`Application is running on port: ${port}`);
}
bootstrap().catch((err) => {
  console.error('Error during bootstrap:', err);
});
