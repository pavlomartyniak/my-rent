import { IsString, Matches } from 'class-validator';

export class SignDto {
  @IsString()
  @Matches(/^\d{6}$/, { message: 'Код складається з шести цифр' })
  code: string;
}
