/* SPDX-FileCopyrightText: 2026 Digitable (Marat Zimnurov) */
/* SPDX-License-Identifier: BSD-2-Clause */

#include "tree_sitter/parser.h"

#include <stdbool.h>
#include <stdint.h>
#include <stdlib.h>
#include <string.h>

// External scanner for FTS's indentation-significant natural surface.
//
// Modelled after the indentation scanners in tree-sitter-python and
// tree-sitter-yaml: three external tokens (NEWLINE, INDENT, DEDENT) are
// produced only when the parser crosses an actual line break, which means
// the legacy brace surface (category Name { ... }) never triggers this
// scanner mid-line and is parsed with ordinary grammar tokens instead.
//
// Blank lines and comment-only lines are transparent to indentation: the
// scanner skips over them while looking for the next line that has real
// content, exactly like natural-parser.ts's sourceLines()/stripLineComment()
// treat them on the reference compiler side.

enum TokenType {
  NEWLINE,
  INDENT,
  DEDENT,
};

typedef struct {
  uint32_t size;
  uint32_t capacity;
  uint16_t *items;
  // Set the first time the scanner observes end-of-file, so the
  // "close the final statement" NEWLINE it implies is reported exactly
  // once. Without this a file that doesn't end in a real '\n' character
  // (or the position right after the last '\n') would ask the scanner
  // for NEWLINE forever - lexer position never moves at true EOF, so
  // nothing would ever stop the parser from calling scan() again.
  bool eof_newline_done;
} indent_stack;

static void stack_init(indent_stack *stack) {
  stack->size = 0;
  stack->capacity = 8;
  stack->items = malloc(stack->capacity * sizeof(uint16_t));
  stack->items[stack->size++] = 0;
  stack->eof_newline_done = false;
}

static void stack_push(indent_stack *stack, uint16_t value) {
  if (stack->size == stack->capacity) {
    stack->capacity *= 2;
    stack->items = realloc(stack->items, stack->capacity * sizeof(uint16_t));
  }
  stack->items[stack->size++] = value;
}

static void stack_pop(indent_stack *stack) {
  if (stack->size > 1) stack->size -= 1;
}

static uint16_t stack_top(indent_stack *stack) {
  return stack->items[stack->size - 1];
}

void *tree_sitter_fts_external_scanner_create(void) {
  indent_stack *stack = malloc(sizeof(indent_stack));
  stack_init(stack);
  return stack;
}

void tree_sitter_fts_external_scanner_destroy(void *payload) {
  indent_stack *stack = (indent_stack *)payload;
  free(stack->items);
  free(stack);
}

unsigned tree_sitter_fts_external_scanner_serialize(void *payload, char *buffer) {
  indent_stack *stack = (indent_stack *)payload;
  uint32_t size = stack->size;
  uint32_t max_size = (TREE_SITTER_SERIALIZATION_BUFFER_SIZE - sizeof(uint32_t) - 1) / sizeof(uint16_t);
  if (size > max_size) size = max_size;

  uint32_t offset = 0;
  memcpy(buffer + offset, &size, sizeof(uint32_t));
  offset += sizeof(uint32_t);
  memcpy(buffer + offset, stack->items, size * sizeof(uint16_t));
  offset += size * sizeof(uint16_t);
  buffer[offset] = stack->eof_newline_done ? 1 : 0;
  offset += 1;
  return offset;
}

void tree_sitter_fts_external_scanner_deserialize(void *payload, const char *buffer, unsigned length) {
  indent_stack *stack = (indent_stack *)payload;
  stack->size = 0;
  stack->eof_newline_done = false;
  if (length == 0) {
    stack->items[stack->size++] = 0;
    return;
  }

  uint32_t offset = 0;
  uint32_t size;
  memcpy(&size, buffer + offset, sizeof(uint32_t));
  offset += sizeof(uint32_t);
  for (uint32_t i = 0; i < size; i += 1) {
    uint16_t value;
    memcpy(&value, buffer + offset, sizeof(uint16_t));
    offset += sizeof(uint16_t);
    stack_push(stack, value);
  }
  if (offset < length) {
    stack->eof_newline_done = buffer[offset] != 0;
    offset += 1;
  }
}

static void skip_line_comment(TSLexer *lexer) {
  // Assumes lookahead is at the second '/' of a '//' already confirmed.
  while (!lexer->eof(lexer) && lexer->lookahead != '\n') {
    lexer->advance(lexer, true);
  }
}

static bool skip_block_comment(TSLexer *lexer) {
  // Assumes lookahead is at the '*' of a '/*' already confirmed.
  lexer->advance(lexer, true); // consume '*'
  int32_t previous = 0;
  while (!lexer->eof(lexer)) {
    if (previous == '*' && lexer->lookahead == '/') {
      lexer->advance(lexer, true);
      return true;
    }
    previous = lexer->lookahead;
    lexer->advance(lexer, true);
  }
  return false;
}

bool tree_sitter_fts_external_scanner_scan(void *payload, TSLexer *lexer, const bool *valid_symbols) {
  indent_stack *stack = (indent_stack *)payload;

  if (!valid_symbols[NEWLINE] && !valid_symbols[INDENT] && !valid_symbols[DEDENT]) {
    return false;
  }

  // NOTE: a single logical "end of line -> new indentation" transition is
  // usually resolved over *several* calls to this function, because NEWLINE
  // and INDENT/DEDENT are separate sequential external tokens in the
  // grammar (mirroring tree-sitter-python's block/_suite structure). The
  // first call that actually crosses a '\n' consumes all the way through to
  // the first real character of the next line (skipping blank lines and
  // comments along the way) and reports whichever token the parser is
  // currently asking for; later calls in the same transition (e.g. further
  // DEDENTs to pop multiple levels) start with the lexer already sitting on
  // that real character - no more whitespace or newline left to cross - so
  // they must still be able to fire based purely on the column comparison.
  bool crossed_newline = false;

  for (;;) {
    if (lexer->eof(lexer)) {
      if (!stack->eof_newline_done) {
        crossed_newline = true;
        stack->eof_newline_done = true;
      }
      break;
    }

    if (lexer->lookahead == '\r') {
      lexer->advance(lexer, true);
      continue;
    }
    if (lexer->lookahead == '\n') {
      lexer->advance(lexer, true);
      crossed_newline = true;
      continue;
    }
    if (lexer->lookahead == ' ' || lexer->lookahead == '\t') {
      lexer->advance(lexer, true);
      continue;
    }
    if (lexer->lookahead == '/') {
      lexer->advance(lexer, true);
      if (lexer->lookahead == '/') {
        lexer->advance(lexer, true);
        skip_line_comment(lexer);
        continue;
      }
      if (lexer->lookahead == '*') {
        lexer->advance(lexer, true);
        skip_block_comment(lexer);
        continue;
      }
      // A lone '/' is real content the grammar doesn't otherwise expect
      // here; stop skipping so the ordinary tokenizer can deal with it.
      break;
    }

    break;
  }

  uint32_t column = lexer->eof(lexer) ? 0 : lexer->get_column(lexer);
  uint16_t top = stack_top(stack);

  if (column > top) {
    if (valid_symbols[INDENT]) {
      stack_push(stack, (uint16_t)column);
      lexer->result_symbol = INDENT;
      lexer->mark_end(lexer);
      return true;
    }
    if (crossed_newline && valid_symbols[NEWLINE]) {
      // Sequential "$._newline, $._indent" grammar position: report the
      // newline now, the following scan() call will produce the INDENT.
      lexer->result_symbol = NEWLINE;
      lexer->mark_end(lexer);
      return true;
    }
    return false;
  }

  if (column < top) {
    if (valid_symbols[DEDENT]) {
      stack_pop(stack);
      lexer->result_symbol = DEDENT;
      lexer->mark_end(lexer);
      return true;
    }
    if (crossed_newline && valid_symbols[NEWLINE]) {
      lexer->result_symbol = NEWLINE;
      lexer->mark_end(lexer);
      return true;
    }
    return false;
  }

  // column == top: no indentation change. Only meaningful if we actually
  // crossed a line break in *this* call - otherwise there is nothing for
  // the external scanner to do here (e.g. mid-line content such as the
  // legacy brace surface's '{').
  if (crossed_newline && valid_symbols[NEWLINE]) {
    lexer->result_symbol = NEWLINE;
    lexer->mark_end(lexer);
    return true;
  }
  return false;
}
