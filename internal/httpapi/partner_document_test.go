package httpapi

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"net/url"
	"os"
	"path/filepath"
	"testing"
)

func TestPartnerHandlerPreservesDocument(t *testing.T) {
	const document = "***108408**"
	api := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/v1/partners" || r.URL.Query().Get("document") != document || r.URL.Query().Get("name") != "JONAS SANTELLO" || r.URL.Query().Get("page") != "2" {
			t.Errorf("unexpected API request: %s", r.URL)
		}
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"data":{"partners":{"items":[],"pagination":{"page":2,"page_size":5,"total_items":10,"total_pages":2}}}}`))
	}))
	defer api.Close()
	configPath := filepath.Join(t.TempDir(), "config.json")
	configData, err := json.Marshal(map[string]any{"api_url": api.URL, "timeout_seconds": 5})
	if err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(configPath, configData, 0600); err != nil {
		t.Fatal(err)
	}
	query := url.Values{"name": {"JONAS SANTELLO"}, "document": {document}, "page": {"2"}, "page_size": {"5"}}
	recorder := httptest.NewRecorder()
	PartnerSearchHandler(configPath)(recorder, httptest.NewRequest(http.MethodGet, "/api/partners?"+query.Encode(), nil))
	if recorder.Code != http.StatusOK {
		t.Fatalf("status = %d, body = %s", recorder.Code, recorder.Body.String())
	}
}
