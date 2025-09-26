export class LexerError extends SyntaxError {
  constructor(message: string, public start: number, public end: number) {
    super(message)
  }
}
