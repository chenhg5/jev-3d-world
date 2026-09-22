package main

import (
	"context"
	"encoding/json"
	"errors"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/chenhg5/jev-3d-world"
	"github.com/chenhg5/jev-3d-world/scene"
)

type composeRequest struct {
	Prompt  string      `json:"prompt"`
	Mode    string      `json:"mode"`
	Current *scene.Spec `json:"current,omitempty"`
}

type composeResponse struct {
	Scene     scene.Spec `json:"scene"`
	ElapsedMS int64      `json:"elapsedMs"`
}

func main() {
	address := valueOr(os.Getenv("SCENE_ADDR"), "127.0.0.1:8788")
	webDir := valueOr(os.Getenv("SCENE_WEB_DIR"), "web/dist")
	if info, err := os.Stat(webDir); err != nil || !info.IsDir() {
		log.Fatalf("web build not found at %s; run npm --prefix web run build", webDir)
	}

	composer := scene.Composer{Evaluator: jevloop.JevClient{
		APIKey: os.Getenv("TYPESAFE_API_KEY"),
	}}
	mux := http.NewServeMux()
	mux.HandleFunc("GET /api/catalog", func(w http.ResponseWriter, _ *http.Request) {
		writeJSON(w, http.StatusOK, scene.Catalog())
	})
	mux.HandleFunc("GET /api/health", func(w http.ResponseWriter, _ *http.Request) {
		writeJSON(w, http.StatusOK, map[string]any{
			"ok": true, "jevConfigured": os.Getenv("TYPESAFE_API_KEY") != "",
		})
	})
	mux.HandleFunc("POST /api/compose", func(w http.ResponseWriter, r *http.Request) {
		if os.Getenv("TYPESAFE_API_KEY") == "" {
			writeError(w, http.StatusServiceUnavailable, "TYPESAFE_API_KEY is not configured")
			return
		}
		r.Body = http.MaxBytesReader(w, r.Body, 32<<10)
		var input composeRequest
		if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
			writeError(w, http.StatusBadRequest, "invalid request body")
			return
		}
		input.Prompt = strings.TrimSpace(input.Prompt)
		if len([]rune(input.Prompt)) < 3 || len([]rune(input.Prompt)) > 600 {
			writeError(w, http.StatusBadRequest, "prompt must contain 3 to 600 characters")
			return
		}
		ctx, cancel := context.WithTimeout(r.Context(), 35*time.Second)
		defer cancel()
		started := time.Now()
		if input.Mode != "" && input.Mode != "replace" && input.Mode != "append" {
			writeError(w, http.StatusBadRequest, "unsupported composition mode")
			return
		}
		if input.Mode == "append" {
			if err := scene.ValidateCurrent(input.Current); err != nil {
				writeError(w, http.StatusBadRequest, err.Error())
				return
			}
		}
		var spec scene.Spec
		var err error
		if input.Mode == "append" {
			spec, err = composer.ComposeAddition(ctx, input.Prompt, *input.Current)
		} else {
			spec, err = composer.Compose(ctx, input.Prompt)
		}
		if err != nil {
			status := http.StatusBadGateway
			message := "Jev could not compose this scene"
			if errors.Is(err, context.DeadlineExceeded) {
				status = http.StatusGatewayTimeout
				message = "Jev request timed out; please try again"
			} else if strings.Contains(err.Error(), "call Jev") {
				message = "Could not connect to Jev; please try again"
			}
			log.Printf("compose failed: %v", err)
			writeError(w, status, message)
			return
		}
		writeJSON(w, http.StatusOK, composeResponse{
			Scene: spec, ElapsedMS: time.Since(started).Milliseconds(),
		})
	})

	static := http.FileServer(http.Dir(webDir))
	mux.Handle("GET /", spaHandler(static, webDir))

	server := &http.Server{
		Addr: address, Handler: securityHeaders(mux),
		ReadHeaderTimeout: 5 * time.Second, ReadTimeout: 10 * time.Second,
		WriteTimeout: 45 * time.Second, IdleTimeout: 60 * time.Second,
	}
	log.Printf("Jev Scene Composer listening on http://%s", address)
	if err := server.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
		log.Fatal(err)
	}
}

func spaHandler(static http.Handler, webDir string) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/" {
			cleanPath := strings.TrimPrefix(filepath.Clean(r.URL.Path), string(filepath.Separator))
			path := filepath.Join(webDir, cleanPath)
			if info, err := os.Stat(path); err == nil && !info.IsDir() {
				static.ServeHTTP(w, r)
				return
			}
		}
		http.ServeFile(w, r, filepath.Join(webDir, "index.html"))
	})
}

func securityHeaders(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("X-Content-Type-Options", "nosniff")
		w.Header().Set("Referrer-Policy", "no-referrer")
		next.ServeHTTP(w, r)
	})
}

func writeJSON(w http.ResponseWriter, status int, value any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	if err := json.NewEncoder(w).Encode(value); err != nil {
		log.Printf("encode response: %v", err)
	}
}

func writeError(w http.ResponseWriter, status int, message string) {
	writeJSON(w, status, map[string]string{"error": message})
}

func valueOr(value, fallback string) string {
	if strings.TrimSpace(value) != "" {
		return value
	}
	return fallback
}

func init() {
	log.SetFlags(log.Ltime | log.Lmicroseconds)
	log.SetPrefix("scene-web ")
}
