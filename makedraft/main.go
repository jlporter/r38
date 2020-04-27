package main

import (
	"bufio"
	"crypto/rand"
	"database/sql"
	"encoding/binary"
	"encoding/csv"
	"flag"
	"fmt"
	_ "github.com/mattn/go-sqlite3"
	"log"
	badrand "math/rand"
	"os"
	"strconv"
)

type cryptoSource struct{}

func (s cryptoSource) Seed(seed int64) {}

func (s cryptoSource) Int63() int64 {
	return int64(s.Uint64() & ^uint64(1<<63))
}

func (s cryptoSource) Uint64() (v uint64) {
	err := binary.Read(rand.Reader, binary.BigEndian, &v)
	if err != nil {
		log.Fatal(err)
	}
	return v
}

func main() {
	draftNamePtr := flag.String("name", "untitled draft", "string")
	filenamePtr := flag.String("filename", "cube.csv", "string")
	databasePtr := flag.String("database", "draft.db", "string")
	flag.Parse()

	name := *draftNamePtr

	var database *sql.DB

	var err error
	database, err = sql.Open("sqlite3", *databasePtr)
	if err != nil {
		log.Printf("error opening database %s: %s", *databasePtr, err)
		return
	}
	err = database.Ping()
	if err != nil {
		log.Printf("error pinging database: %s", err)
		return
	}

	query := `INSERT INTO drafts (name) VALUES (?);`
	res, err := database.Exec(query, name)
	if err != nil {
		log.Printf("error creating draft: %s", err)
		return
	}

	draftId, err := res.LastInsertId()
	if err != nil {
		log.Printf("could not get draft ID: %s", err)
		return
	}
	query = `INSERT INTO seats (position, draft) VALUES (?, ?)`
	var seatIds [9]int64
	for i := 0; i < 8; i++ {
		res, err = database.Exec(query, i, draftId)
		if err != nil {
			log.Printf("could not create seats in draft: %s", err)
			return
		}
		seatIds[i], err = res.LastInsertId()
		if err != nil {
			log.Printf("could not finalize seat creation: %s", err)
			return
		}
	}

	res, err = database.Exec(`INSERT INTO seats (position, draft) VALUES(NULL, ?)`, draftId)
	if err != nil {
		log.Printf("error assigning seats: %s", err)
		return
	}
	seatIds[8], err = res.LastInsertId()
	if err != nil {
		log.Printf("error assigning seats: %s", err)
		return
	}

	query = `INSERT INTO packs (seat, original_seat, modified, round) VALUES (?, ?, 0, ?)`
	var packIds [25]int64
	for i := 0; i < 8; i++ {
		for j := 0; j < 4; j++ {
			res, err = database.Exec(query, seatIds[i], seatIds[i], j)
			if err != nil {
				log.Printf("error creating packs: %s", err)
				return
			}
			if j != 0 {
				packIds[(3*i)+(j-1)], err = res.LastInsertId()
				if err != nil {
					log.Printf("error creating packs: %s", err)
					return
				}
			}
		}
	}

	res, err = database.Exec(`INSERT INTO packs (seat, original_seat, modified, round) VALUES (?, ?, 0, NULL)`, seatIds[8], seatIds[8])
	if err != nil {
		log.Printf("error creating packs: %s", err)
		return
	}
	packIds[24], err = res.LastInsertId()
	if err != nil {
		log.Printf("error creating packs: %s", err)
		return
	}

	query = `INSERT INTO cards (pack, original_pack, edition, number, tags, name, cmc, type, color, mtgo) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
	file, err := os.Open(*filenamePtr)
	if err != nil {
		log.Printf("could not open file %s: %s", *filenamePtr, err)
		return
	}
	defer file.Close()

	// read the first line as a text file and throw it away
	normalReader := bufio.NewReader(file)
	_, _, err = normalReader.ReadLine()
	if err != nil {
		log.Printf("error discarding first line of file %s: %s", *filenamePtr, err)
		return
	}

	reader := csv.NewReader(normalReader)
	if err != nil {
		log.Printf("error processing CSV file %s: %s", *filenamePtr, err)
		return
	}

	lines, err := reader.ReadAll()
	if err != nil {
		log.Printf("error reading CSV file %s: %s", *filenamePtr, err)
		return
	}

	var src cryptoSource
	rnd := badrand.New(src)
	for i := 539; i > 164; i-- {
		j := rnd.Intn(i)
		lines[i], lines[j] = lines[j], lines[i]
		packId := packIds[(539-i)/15]
		finish := lines[i][7]
		mtgoId := lines[i][12]
		if finish == "Foil" {
			// if a card is foil, increment the mtgo id
			mtgoIdInt, err := strconv.Atoi(mtgoId)
			if err != nil {
				log.Printf("could not convert foil version %s: %s", mtgoId, err)
				return
			}
			mtgoIdInt++
			mtgoId = fmt.Sprintf("%d", mtgoIdInt)
		}
		database.Exec(query, packId, packId, lines[i][4], lines[i][5], lines[i][10], lines[i][0], lines[i][1], lines[i][2], lines[i][3], mtgoId)
	}
	fmt.Printf("done generating new draft\n")
}