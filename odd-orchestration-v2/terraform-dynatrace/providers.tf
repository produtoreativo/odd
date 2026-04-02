terraform {
  required_version = ">= 1.5.0"

  required_providers {
    dynatrace = {
      source  = "dynatrace-oss/dynatrace"
      version = ">= 1.0.0"
    }
  }
}

provider "dynatrace" {}
