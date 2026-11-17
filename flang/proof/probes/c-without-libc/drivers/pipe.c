/*
 * Труба между пробой и генератором, собранным из исходника (цель from-source).
 *
 *   pipe request <имя файла программы>   печатает запрос прогонщику: одна строка JSON
 *   pipe unpack <каталог>                читает ответ прогонщика и раскладывает файлы
 *
 * Ответ генератора — один текст: «==== имя\n» перед каждым файлом либо
 * «REFUSED причина». При отказе unpack пишет причину в <каталог>/REFUSED.txt.
 */
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

static void put_text(const char *text, size_t bytes) {
  size_t i = 0;
  putchar('"');
  for (i = 0; i < bytes; i += 1) {
    unsigned char c = (unsigned char)text[i];
    if (c == '"' || c == '\\') {
      putchar('\\');
      putchar(c);
    } else if (c == '\n') {
      fputs("\\n", stdout);
    } else if (c == '\t') {
      fputs("\\t", stdout);
    } else if (c == '\r') {
      fputs("\\r", stdout);
    } else if (c < 0x20) {
      printf("\\u%04x", c);
    } else {
      putchar(c);
    }
  }
  putchar('"');
}

static char *read_all(FILE *in, size_t *bytes) {
  size_t room = 1 << 16;
  size_t used = 0;
  char *text = malloc(room);
  size_t got = 0;
  if (text == NULL) {
    return NULL;
  }
  while ((got = fread(text + used, 1, room - used - 1, in)) > 0) {
    used += got;
    if (room - used < 2) {
      char *more = realloc(text, room * 2);
      if (more == NULL) {
        free(text);
        return NULL;
      }
      text = more;
      room *= 2;
    }
  }
  text[used] = '\0';
  *bytes = used;
  return text;
}

static int request(const char *path) {
  size_t bytes = 0;
  FILE *in = fopen(path, "rb");
  char *text = in == NULL ? NULL : read_all(in, &bytes);
  if (text == NULL) {
    fprintf(stderr, "pipe: не читается %s\n", path);
    return 2;
  }
  fclose(in);
  fputs("{\"fn\":\"Сгенерировать из связанного\",\"args\":[{\"s\":", stdout);
  put_text(path, strlen(path));
  fputs("},{\"s\":", stdout);
  put_text(text, bytes);
  fputs("}],\"steps\":\"100000000000\",\"depth\":\"100000\"}\n", stdout);
  free(text);
  return 0;
}

/* Снимает экранирование строки JSON на месте; возвращает длину. */
static size_t unescape(char *text) {
  size_t read = 0;
  size_t write = 0;
  while (text[read] != '\0' && text[read] != '"') {
    if (text[read] == '\\' && text[read + 1] != '\0') {
      char c = text[read + 1];
      read += 2;
      if (c == 'n') {
        text[write++] = '\n';
      } else if (c == 't') {
        text[write++] = '\t';
      } else if (c == 'r') {
        text[write++] = '\r';
      } else if (c == 'u') {
        text[write++] = (char)strtol((char[]){text[read], text[read + 1], text[read + 2], text[read + 3], 0}, NULL, 16);
        read += 4;
      } else {
        text[write++] = c;
      }
    } else {
      text[write++] = text[read++];
    }
  }
  text[write] = '\0';
  return write;
}

static int unpack(const char *dir) {
  static const char start[] = "{\"ok\":true,\"value\":{\"s\":\"";
  static const char mark[] = "==== ";
  size_t bytes = 0;
  char *reply = read_all(stdin, &bytes);
  char *text = NULL;
  char *at = NULL;
  char name[1024];
  if (reply == NULL || strncmp(reply, start, sizeof(start) - 1) != 0) {
    fprintf(stderr, "pipe: генератор не ответил текстом: %.300s\n", reply == NULL ? "" : reply);
    return 2;
  }
  text = reply + sizeof(start) - 1;
  unescape(text);
  if (strncmp(text, "REFUSED ", 8) == 0) {
    FILE *out = NULL;
    snprintf(name, sizeof(name), "%s/REFUSED.txt", dir);
    out = fopen(name, "wb");
    if (out == NULL) {
      return 2;
    }
    fprintf(out, "%s\n", text + 8);
    fclose(out);
    return 0;
  }
  at = strstr(text, mark);
  while (at != NULL) {
    char *line = strchr(at, '\n');
    char *next = NULL;
    FILE *out = NULL;
    if (line == NULL) {
      return 2;
    }
    *line = '\0';
    snprintf(name, sizeof(name), "%s/%s", dir, at + sizeof(mark) - 1);
    next = strstr(line + 1, "\n==== ");
    out = fopen(name, "wb");
    if (out == NULL) {
      fprintf(stderr, "pipe: не пишется %s\n", name);
      return 2;
    }
    if (next == NULL) {
      fputs(line + 1, out);
      at = NULL;
    } else {
      fwrite(line + 1, 1, (size_t)(next + 1 - (line + 1)), out);
      at = next + 1;
    }
    fclose(out);
  }
  free(reply);
  return 0;
}

int main(int argc, char **argv) {
  if (argc == 3 && strcmp(argv[1], "request") == 0) {
    return request(argv[2]);
  }
  if (argc == 3 && strcmp(argv[1], "unpack") == 0) {
    return unpack(argv[2]);
  }
  fputs("pipe request <файл> | pipe unpack <каталог>\n", stderr);
  return 2;
}
