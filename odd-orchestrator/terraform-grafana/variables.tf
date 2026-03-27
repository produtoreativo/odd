variable "grafana_url" {
  type    = string
  default = ""
}

variable "grafana_auth" {
  type      = string
  sensitive = true
  default   = ""
}
