variable "datadog_api_key" {
  type      = string
  sensitive = true
  default   = ""
}

variable "datadog_app_key" {
  type      = string
  sensitive = true
  default   = ""
}

variable "datadog_api_url" {
  type    = string
  default = "https://api.datadoghq.com/"
}
