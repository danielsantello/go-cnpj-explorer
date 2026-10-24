package webui

import (
	"embed"
	"io/fs"
	"net/http"
)

//go:embed static
var assets embed.FS

// NewHandler serve as páginas e os arquivos estáticos embutidos no executável.
func NewHandler() (http.Handler, error) {
	files, err := fs.Sub(assets, "static")
	if err != nil {
		return nil, err
	}

	return http.FileServer(http.FS(files)), nil
}
