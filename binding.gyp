{
  "targets": [
    {
      "target_name": "corsair",
      "sources": [
        "src/corsair.cc"
      ],
      "include_dirs": [
        "node_modules/node-addon-api",
        "cue-sdk-4.0.84/src/include"
      ],
      "cflags!": ["-fno-exceptions"],
      "cflags_cc!": ["-fno-exceptions"],
      "conditions": [
        [
          "OS=='win'",
          {
            "msvs_settings": {
              "VCCLCompilerTool": {
                "ExceptionHandling": 1
              }
            }
          }
        ]
      ]
    }
  ]
}
