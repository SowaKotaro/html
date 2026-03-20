# 100マス計算ジェネレーター

## 概要
100マス計算のプリントを生成するExcelマクロ。

## 機能
- 縦軸と横軸の項目を重複なしランダムで生成
- 項目は0から9の10個
- 縦軸と横軸の項目はランダムに並び替え
- sheet1には足し算か掛け算のどちらかをプルダウンメニューで選択できる
- sheet1に設置されたボタンを押下すると縦軸と横軸の整数が再生成
- sheet2には模範解答が記載される

## 手順
1. 新規でエクセルファイルを開く
2. M1セルを選択し、「データ」タブ -> 「データの入力規則」 -> 「データの入力規則」 -> 「入力値の種類」->「リスト」->「元の値」に「+,*」と入力 -> 「OK」をクリック
3. 「開発」タブ -> 「Visual Basic」をクリック
4. 「挿入」->「標準モジュール」をクリック
5. 以下のコードを貼り付け
```
Option Explicit

' メイン処理（ボタンに紐づけ）
Sub GenerateHyakumasu()
    Dim rowNums As Variant
    Dim colNums As Variant
    
    Randomize
    
    rowNums = GetRandomArray()
    colNums = GetRandomArray()
    
    ' Sheet1（表示）
    Call WriteHeadersToSheet(Sheets("Sheet1"), rowNums, colNums)
    
    ' Sheet2（解答）
    Call WriteHeadersToSheet(Sheets("Sheet2"), rowNums, colNums)
    
    Call SaveAnswers(rowNums, colNums)
    Call DisplayMode
End Sub

' 0?9のランダム配列（重複なし）
Function GetRandomArray() As Variant
    Dim arr(0 To 9) As Integer
    Dim i As Integer, j As Integer, temp As Integer
    
    ' 初期化
    For i = 0 To 9
        arr(i) = i
    Next i
    
    ' シャッフル（Fisher-Yates）
    For i = 9 To 1 Step -1
        j = Int(Rnd() * (i + 1))
        temp = arr(i)
        arr(i) = arr(j)
        arr(j) = temp
    Next i
    
    GetRandomArray = arr
End Function

' 行列ヘッダ書き込み
Sub WriteHeadersToSheet(ws As Worksheet, rowNums As Variant, colNums As Variant)
    Dim i As Integer
    
    ' 列（B2?K2）
    For i = 0 To 9
        ws.Cells(2, i + 2).Value = colNums(i)
    Next i
    
    ' 行（A3?A12）
    For i = 0 To 9
        ws.Cells(i + 3, 1).Value = rowNums(i)
    Next i
End Sub

Sub SaveAnswers(rowNums As Variant, colNums As Variant)
    Dim i As Integer, j As Integer
    Dim op As String
    
    op = Sheets("Sheet1").Range("M1").Value
    
    For i = 0 To 9
        For j = 0 To 9
            
            If op = "+" Then
                Sheets("Sheet2").Cells(i + 3, j + 2).Value = rowNums(i) + colNums(j)
            ElseIf op = "*" Then
                Sheets("Sheet2").Cells(i + 3, j + 2).Value = rowNums(i) * colNums(j)
            End If
            
        Next j
    Next i
End Sub

Sub Auto_Open()
    Randomize
End Sub

Sub DisplayMode()
    Dim i As Integer, j As Integer
    Dim mode As String
    
    mode = Sheets("Sheet1").Range("M2").Value
    
    For i = 0 To 9
        For j = 0 To 9
            
            If mode = "解答" Then
                ' 解答表示
                Sheets("Sheet1").Cells(i + 3, j + 2).Value = _
                    Sheets("Sheet2").Cells(i + 3, j + 2).Value
            Else
                ' 問題（空欄）
                Sheets("Sheet1").Cells(i + 3, j + 2).ClearContents
            End If
            
        Next j
    Next i
End Sub
```

6. VBAProjectのツリーのSheet1(Sheet1)ダブルクリック
7. 以下のコードを貼り付け
```
Private Sub Worksheet_Change(ByVal Target As Range)
    If Not Intersect(Target, Range("M2")) Is Nothing Then
        Call DisplayMode
    End If
End Sub
```

8. VBAの画面の保存ボタンをクリック（名前は適当に）
9. 画面下部の「+」をクリックしてsheet2を作成
10. 「開発」タブ -> 「挿入」->「フォームコントロール」->「ボタン」をクリック
11. M1の下あたりにボタンを配置
12. 「マクロの登録」ダイアログで「GenerateHyakumasu」を選択して「OK」をクリック
13. ボタンの文字を「作成」に変更