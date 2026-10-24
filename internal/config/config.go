package config

import (
	"encoding/json"
	"errors"
	"fmt"
	"net/url"
	"os"
	"path/filepath"
)

type Config struct {
	APIURL         string `json:"api_url"`
	TimeoutSeconds int    `json:"timeout_seconds"`
}

func Default() Config {
	return Config{
		APIURL:         "http://localhost:8080",
		TimeoutSeconds: 30,
	}
}

func Load(path string) (Config, error) {
	cfg := Default()

	data, err := os.ReadFile(path)
	if errors.Is(err, os.ErrNotExist) {
		return cfg, nil
	}
	if err != nil {
		return Config{}, fmt.Errorf("ler configuração: %w", err)
	}

	if err := json.Unmarshal(data, &cfg); err != nil {
		return Config{}, fmt.Errorf("interpretar configuração: %w", err)
	}

	if err := cfg.Validate(); err != nil {
		return Config{}, err
	}

	return cfg, nil
}

func (c Config) Validate() error {
	u, err := url.Parse(c.APIURL)
	if err != nil {
		return fmt.Errorf("endereço da API inválido: %w", err)
	}

	if (u.Scheme != "http" && u.Scheme != "https") || u.Hostname() == "" {
		return errors.New("o endereço da API deve usar http ou https e informar um servidor")
	}

	if u.User != nil || u.RawQuery != "" || u.Fragment != "" {
		return errors.New("o endereço da API não deve conter credenciais, parâmetros ou fragmentos")
	}

	if c.TimeoutSeconds < 1 || c.TimeoutSeconds > 120 {
		return errors.New("o tempo limite deve estar entre 1 e 120 segundos")
	}

	return nil
}

func Save(path string, cfg Config) error {
	if err := cfg.Validate(); err != nil {
		return err
	}

	data, err := json.MarshalIndent(cfg, "", "  ")
	if err != nil {
		return fmt.Errorf("serializar configuração: %w", err)
	}

	data = append(data, '\n')

	temp, err := os.CreateTemp(filepath.Dir(path), ".config-*.tmp")
	if err != nil {
		return fmt.Errorf("criar arquivo temporário: %w", err)
	}

	tempPath := temp.Name()

	defer os.Remove(tempPath)

	if _, err := temp.Write(data); err != nil {
		temp.Close()
		return fmt.Errorf("escrever configuração: %w", err)
	}

	if err := temp.Close(); err != nil {
		return fmt.Errorf("fechar arquivo temporário: %w", err)
	}

	if err := os.Rename(tempPath, path); err != nil {
		return fmt.Errorf("substituir arquivo de configuração: %w", err)
	}

	return nil
}
