package cnpjapi

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"
)

func TestPartnerDocumentForwarding(t *testing.T) {
	for _, document := range []string{"", "***108408**", "123&456+789"} {
		t.Run(document, func(t *testing.T) {
			server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				if r.URL.Path != "/v1/partners" {
					t.Errorf("path = %q", r.URL.Path)
				}
				query := r.URL.Query()
				if query.Get("document") != document || query.Get("name") != "JONAS SANTELLO" || query.Get("page") != "2" || query.Get("page_size") != "5" {
					t.Errorf("unexpected query: %v", query)
				}
				if document == "" && query.Has("document") {
					t.Error("empty document should be omitted")
				}
				w.Header().Set("Content-Type", "application/json")
				_, _ = w.Write([]byte(`{"data":{"partners":{"items":[],"pagination":{"page":2,"page_size":5,"total_items":10,"total_pages":2}}}}`))
			}))
			defer server.Close()
			client := NewClient(server.URL, time.Second)
			result, err := client.SearchPartners(context.Background(), "JONAS SANTELLO", 2, 5, document)
			if err != nil || result.Pagination.Page != 2 {
				t.Fatalf("result = %+v, err = %v", result, err)
			}
		})
	}
}
