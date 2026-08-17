// ─── Voice Service (STT) ──────────────────────────────────────────────────
// Uses Deepgram for Speech-to-Text transcription.

import { Injectable, Logger, InternalServerErrorException } from '@nestjs/common';
import { createClient } from '@deepgram/sdk';

export interface TranscriptResult {
  text: string;
  overallConfidence: number;
  wordConfidences: Array<{ word: string; confidence: number }>;
}

@Injectable()
export class VoiceService {
  private readonly logger = new Logger(VoiceService.name);
  private deepgram;

  constructor() {
    const apiKey = process.env.DEEPGRAM_API_KEY;
    // We instantiate it even if apiKey is missing, but log a warning
    // so the app still boots if they only use text commands.
    if (!apiKey) {
      this.logger.warn('DEEPGRAM_API_KEY is not set. Voice commands will fail.');
    }
    this.deepgram = createClient(apiKey || 'dummy');
  }

  /**
   * Transcribe an audio buffer using Deepgram Nova-3 model.
   */
  async transcribe(audioBuffer: Buffer, mimetype: string): Promise<TranscriptResult> {
    try {
      const { result, error } = await this.deepgram.listen.prerecorded.transcribeFile(
        audioBuffer,
        {
          model: 'nova-3',
          smart_format: true,
        }
      );

      if (error) {
        throw error;
      }

      const channel = result?.results?.channels?.[0];
      const alternative = channel?.alternatives?.[0];
      
      if (!alternative) {
        throw new Error('No transcription alternatives returned');
      }

      const text = alternative.transcript;
      const overallConfidence = alternative.confidence;
      const wordConfidences = alternative.words.map(w => ({
        word: w.word,
        confidence: w.confidence,
      }));

      this.logger.log(`Transcribed [${overallConfidence.toFixed(2)}]: "${text}"`);

      return {
        text,
        overallConfidence,
        wordConfidences,
      };
    } catch (err) {
      this.logger.error(`Transcription failed:`, err);
      throw new InternalServerErrorException('Failed to transcribe audio.');
    }
  }
}
