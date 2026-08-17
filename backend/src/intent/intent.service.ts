// ─── Intent Service ─────────────────────────────────────────────────────────
// Uses OpenAI to extract structured intents from text/transcripts.

import { Injectable, Logger, InternalServerErrorException } from '@nestjs/common';
import OpenAI from 'openai';
import { openaiFunctionSchema } from './intent.schema';
import { ParsedIntentSchema, type ParsedIntent } from '../common/types/intent.types';
import type { SessionContext } from '../common/types/intent.types';

@Injectable()
export class IntentService {
  private readonly logger = new Logger(IntentService.name);
  private openai: OpenAI;

  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }

  /**
   * Extract a structured intent from a raw transcript.
   * Feeds the warehouse catalog into the system prompt for grounding.
   */
  async extractIntent(
    transcript: string,
    context: SessionContext,
  ): Promise<ParsedIntent> {
    try {
      // Build context for the LLM
      const systemPrompt = `
You are a Voice-WMS intent extraction engine.
Your job is to parse warehouse operator speech into structured JSON commands.

# Context
Warehouse: ${context.warehouseName}
User: ${context.userName} (Role: ${context.userRole})

# Catalog (Use this to resolve partial names to exact codes if possible, but output exactly what you hear if unsure)
Locations: ${context.locationCatalog.map(l => l.code).join(', ')}
SKUs: ${context.skuCatalog.map(s => s.code).join(', ')}

# Rules
1. ALWAYS use the extract_warehouse_intent function.
2. If the user mentions a partial location (e.g., "Bay A"), map it to the exact code if obvious (e.g., "BAY-A").
3. If the input is ambiguous or missing required fields (like quantity), note it in "ambiguities" and lower the "confidence".
4. If the user is cancelling or reverting, use "undo_last".
      `;

      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: transcript },
        ],
        tools: [{ type: 'function', function: openaiFunctionSchema }],
        tool_choice: { type: 'function', function: { name: 'extract_warehouse_intent' } },
        temperature: 0,
      });

      const toolCall = response.choices[0].message.tool_calls?.[0];
      if (!toolCall || toolCall.type !== 'function') {
        throw new Error('OpenAI did not return a function tool call.');
      }

      const args = JSON.parse(toolCall.function.arguments);

      // Validate the LLM output against our strict Zod schema
      const parsedIntent = ParsedIntentSchema.parse(args);
      
      this.logger.log(`Extracted intent: ${parsedIntent.intent} with confidence ${parsedIntent.confidence}`);
      return parsedIntent;
    } catch (error) {
      this.logger.error(`Intent extraction failed:`, error);
      throw new InternalServerErrorException('Failed to extract intent from transcript.');
    }
  }
}
