/*
 * This file is part of KubeSphere Console.
 * Copyright (C) 2019 The KubeSphere Console Authors.
 *
 * KubeSphere Console is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * KubeSphere Console is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with KubeSphere Console.  If not, see <https://www.gnu.org/licenses/>.
 */

import React from 'react'
import AceEditor from 'react-ace'

import 'ace-builds/src-noconflict/mode-yaml'
import 'ace-builds/src-noconflict/mode-groovy'
import 'ace-builds/src-noconflict/theme-chaos'
import 'ace-builds/src-noconflict/keybinding-vscode'
import 'ace-builds/src-noconflict/ext-searchbox'
import 'ace-builds/src-noconflict/ext-language_tools'

import { config } from 'ace-builds'
import yamlWorker from 'ace-builds/src-noconflict/worker-yaml'
import xmlWorker from 'ace-builds/src-noconflict/worker-xml'
import javascriptWorker from 'ace-builds/src-noconflict/worker-javascript'
import jsonWorker from 'ace-builds/src-noconflict/worker-json'

import './custom.css'

// fix ace-build worker-loader
config.setModuleUrl('ace/mode/yaml_worker', yamlWorker)
config.setModuleUrl('ace/mode/xml_worker', xmlWorker)
config.setModuleUrl('ace/mode/javascript_worker', javascriptWorker)
config.setModuleUrl('ace/mode/json_worker', jsonWorker)

export default class AceEditorWrapper extends React.Component {
  render() {
    return (
      <AceEditor
        setOptions={{
          enableBasicAutocompletion: true,
          enableLiveAutocompletion: true,
        }}
        theme="chaos"
        width="auto"
        height="100%"
        tabSize={2}
        editorProps={{ $blockScrolling: true }}
        showPrintMargin={false}
        keyboardHandler="vscode"
        wrapEnabled
        {...this.props}
      />
    )
  }
}
