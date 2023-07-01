import { z } from 'nestjs-zod/z';
import { createZodDto } from 'nestjs-zod';

const loginSchema = z.object({
  user_name: z.string(), // using username for login only
});

const msgSchema = z.object({
  msg_hash: z.string(),
  to_username: z.string(),
  content: z.string(),
  type: z.enum(['msg', 'file']),
  file_name: z.string().optional(),
});

class LoginDto extends createZodDto(loginSchema) {}
class MsgDto extends createZodDto(msgSchema) {}

export { LoginDto, MsgDto };
