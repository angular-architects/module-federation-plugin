import { BuildExecutorSchema } from './schema';

export default async function runExecutor(
  options: BuildExecutorSchema,
  nowos: unknown,
) {
  console.log('Executor ran for Build', options, nowos);

  return {
    success: true,
  };
}
