import { IsEmail, IsString, MinLength } from 'class-validator';

export class CreateUserDto {
  @IsString()
  @MinLength(2)
  displayName: string;

  @IsEmail()
  email: string;
}
